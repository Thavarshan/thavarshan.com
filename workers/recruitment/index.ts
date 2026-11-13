import { z } from "zod";
import { verifyAccessJwt } from "../job-review/access";
import { isSameOrigin } from "../../src/shared/edge/origin";
import { OPPORTUNITY_ID_PATTERN, reviewStatuses } from "../../src/features/jobs/review";
import { fetchJsonBounded, formatLog, RateLimiter, requestIdFor } from "../../src/shared/edge/platform";
import { exportLegacyKV, type ReadOnlyKV } from "./legacy";
import {
  OAuthInvalidState,
  OAuthRejected,
  OAuthUnavailable,
  beginGmailAuthorization,
  completeGmailAuthorization,
  gmailConnectionStatus,
  oauthReady,
  type GmailOAuthSettings
} from "./gmail-oauth";
import {
  VersionConflict,
  databaseReady,
  getLegacyImport,
  importLegacyReviews,
  importSnapshotPage,
  listOpportunities,
  listReviews,
  saveReview,
  validateSnapshot,
  type Database
} from "./storage";

export interface Env extends GmailOAuthSettings {
  RECRUITMENT_DB: Database;
  JOBS_KV: ReadOnlyKV;
  JOBS_DATA_URL: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ALLOWED_EMAIL?: string;
  /** Local development only; production traffic must always have an Access JWT. */
  DEV_AUTH_BYPASS?: string;
  READ_ONLY?: string;
  WORKER_VERSION?: string;
}

export const routes = [
  "GET /healthz",
  "GET /v1/snapshot",
  "POST /v1/snapshot/import",
  "GET /v1/opportunities",
  "GET /v1/reviews",
  "POST /v1/reviews/:id",
  "GET /v1/legacy/export",
  "POST /v1/legacy/import",
  "GET /v1/gmail/connect",
  "GET /v1/gmail/status",
  "POST /v1/gmail/authorize",
  "GET /v1/gmail/callback"
] as const;

/** Unknown request paths are untrusted input and must not appear in private logs. */
function logRoute(pathname: string): string {
  if (/^\/v1\/reviews\/[a-f0-9]{20}$/.test(pathname)) return "/v1/reviews/:id";
  if (routes.some((entry) => entry.endsWith(` ${pathname}`))) return pathname;
  return "<unmatched>";
}

const headers: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin"
};
const gmailConnectPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect Gmail</title>
  </head>
  <body>
    <main>
      <h1>Connect Gmail</h1>
      <p>Continue to Google to connect the owner account with Gmail read-only access.</p>
      <p>This first step does not download or change any messages.</p>
      <form method="post" action="/v1/gmail/authorize">
        <input type="hidden" name="flow" value="connect">
        <button type="submit">Continue to Google</button>
      </form>
    </main>
  </body>
</html>`;
const readLimiter = new RateLimiter(90, 60_000);
const writeLimiter = new RateLimiter(20, 60_000);
const reviewInput = z
  .object({ status: z.enum(reviewStatuses), note: z.string().max(500), expectedRevision: z.number().int().min(0).max(2_000_000_000) })
  .strict();
const snapshotInput = z.object({ expectedGeneratedAt: z.string().datetime(), offset: z.number().int().nonnegative() }).strict();
const migrationInput = z.object({ checksum: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

function json(status: number, value: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...headers, ...extraHeaders } });
}

async function authorized(request: Request, env: Env) {
  const url = new URL(request.url);
  if (env.DEV_AUTH_BYPASS === "1" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALLOWED_EMAIL) return false;
  return (
    (await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      allowedEmail: env.ALLOWED_EMAIL
    })) !== null
  );
}

/** Reject oversized JSON before parsing, even when Content-Length is missing or dishonest. */
async function boundedJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new UnsupportedType();
  const max = 4096;
  if (Number(request.headers.get("content-length")) > max) throw new OversizedBody();
  if (!request.body) throw new SyntaxError("Empty body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) throw new OversizedBody();
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
class OversizedBody extends Error {}
class UnsupportedType extends Error {}

function pagination(url: URL) {
  const after = url.searchParams.get("after") ?? "";
  const limitRaw = url.searchParams.get("limit") ?? "40";
  if ((after && !OPPORTUNITY_ID_PATTERN.test(after)) || !/^\d{1,2}$/.test(limitRaw)) throw new RangeError("Invalid pagination");
  const limit = Number(limitRaw);
  if (limit < 1 || limit > 40) throw new RangeError("Invalid pagination");
  return { after, limit };
}

async function dispatch(request: Request, env: Env, fetcher: typeof fetch, now: string): Promise<Response> {
  if (!(await authorized(request, env))) return json(403, { error: "Forbidden" });
  if (request.method === "OPTIONS") return json(405, { error: "Method not allowed" });

  const url = new URL(request.url);
  const write = request.method === "POST";
  const limiter = write ? writeLimiter : readLimiter;
  const decision = limiter.check(`${write ? "write" : "read"}:${request.headers.get("cf-connecting-ip") ?? "local"}`);
  if (!decision.allowed) return json(429, { error: "Too many requests" }, { "Retry-After": String(decision.retryAfterSeconds) });
  const browserForm =
    write &&
    url.pathname === "/v1/gmail/authorize" &&
    (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase() === "application/x-www-form-urlencoded";
  const sameOriginBrowserNavigation =
    browserForm &&
    request.headers.get("Sec-Fetch-Site") === "same-origin" &&
    request.headers.get("Sec-Fetch-Mode") === "navigate" &&
    request.headers.get("Sec-Fetch-Dest") === "document";
  if (write && !isSameOrigin(request, url) && !sameOriginBrowserNavigation) return json(403, { error: "Cross-origin request rejected" });
  // The OAuth callback is a state-changing GET; previews must refuse it too.
  if (env.READ_ONLY === "1" && (write || url.pathname === "/v1/gmail/callback")) return json(403, { error: "Preview is read-only" });

  if (!env.RECRUITMENT_DB || !env.JOBS_KV || !env.JOBS_DATA_URL) return json(503, { error: "Private storage is not configured" });
  const db = env.RECRUITMENT_DB;

  if (request.method === "GET" && url.pathname === "/healthz") {
    const ready = await databaseReady(db);
    return json(ready ? 200 : 503, {
      status: ready ? "ok" : "unavailable",
      schema: ready ? 1 : null,
      version: env.WORKER_VERSION ?? "dev",
      mode: env.READ_ONLY === "1" ? "preview" : "private"
    });
  }

  if (!(await databaseReady(db))) return json(503, { error: "Database migrations have not been applied" });

  if (url.pathname.startsWith("/v1/gmail/")) {
    if (!(await oauthReady(db))) return json(503, { error: "Gmail OAuth migration has not been applied" });
    if (request.method === "GET" && url.pathname === "/v1/gmail/connect")
      return new Response(gmailConnectPage, {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://accounts.google.com"
        }
      });
    if (request.method === "GET" && url.pathname === "/v1/gmail/status") return json(200, await gmailConnectionStatus(db, env));
    if (request.method === "POST" && url.pathname === "/v1/gmail/authorize") {
      if (browserForm) {
        const form = await request.formData();
        if (form.get("flow") !== "connect") return json(400, { error: "Invalid authorization request" });
      }
      const authorization = await beginGmailAuthorization(db, env, url, new Date(now));
      if (browserForm)
        return new Response(null, {
          status: 303,
          headers: {
            "Cache-Control": "no-store",
            Location: authorization.authorizationUrl,
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff"
          }
        });
      return json(200, authorization);
    }
    if (request.method === "GET" && url.pathname === "/v1/gmail/callback") {
      await completeGmailAuthorization(db, env, url, new Date(now), fetcher);
      return new Response(null, {
        status: 303,
        headers: { ...headers, Location: `${url.origin}/v1/gmail/status` }
      });
    }
  }

  if (request.method === "GET" && url.pathname === "/v1/snapshot") {
    const snapshot = validateSnapshot(await fetchJsonBounded(env.JOBS_DATA_URL, fetcher));
    return json(200, { schemaVersion: snapshot.schemaVersion, generatedAt: snapshot.generatedAt, total: snapshot.opportunities.length, pageSize: 20 });
  }
  if (request.method === "POST" && url.pathname === "/v1/snapshot/import") {
    const input = snapshotInput.parse(await boundedJson(request));
    const snapshot = validateSnapshot(await fetchJsonBounded(env.JOBS_DATA_URL, fetcher));
    return json(200, await importSnapshotPage(db, snapshot, input.offset, input.expectedGeneratedAt, now));
  }
  if (request.method === "GET" && url.pathname === "/v1/opportunities") {
    const { after, limit } = pagination(url);
    const items = await listOpportunities(db, after, limit);
    return json(200, { items, nextCursor: items.length === limit ? items.at(-1)?.id : null });
  }
  if (request.method === "GET" && url.pathname === "/v1/reviews") {
    const { after, limit } = pagination(url);
    const items = await listReviews(db, after, limit);
    return json(200, { items, nextCursor: items.length === limit ? items.at(-1)?.opportunityId : null });
  }
  const reviewMatch = url.pathname.match(/^\/v1\/reviews\/([a-f0-9]{20})$/);
  if (request.method === "POST" && reviewMatch) {
    const input = reviewInput.parse(await boundedJson(request));
    return json(200, await saveReview(db, { ...input, opportunityId: reviewMatch[1] }, now));
  }
  if (request.method === "GET" && url.pathname === "/v1/legacy/export") {
    const backup = await exportLegacyKV(env.JOBS_KV);
    return json(200, backup, { "Content-Disposition": 'attachment; filename="job-review-kv-backup.json"' });
  }
  if (request.method === "POST" && url.pathname === "/v1/legacy/import") {
    const input = migrationInput.parse(await boundedJson(request));
    const completed = await getLegacyImport(db);
    if (completed && completed.checksum !== input.checksum) throw new VersionConflict("Legacy data already imported");
    if (completed) return json(200, { imported: false, recordCount: completed.recordCount });
    const backup = await exportLegacyKV(env.JOBS_KV);
    if (backup.checksum !== input.checksum) throw new VersionConflict("KV changed since the backup was downloaded; export again");
    return json(200, await importLegacyReviews(db, backup.checksum, backup.reviews, now));
  }

  if (routes.some((entry) => entry.includes(` ${url.pathname}`)) || (request.method !== "POST" && reviewMatch))
    return json(405, { error: "Method not allowed" });
  return json(404, { error: "Not found" });
}

export async function handleRequest(
  request: Request,
  env: Env,
  options: { fetcher?: typeof fetch; now?: Date; log?: (line: string) => void } = {}
): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdFor(request);
  // Never log job IDs, unknown path components, request bodies, notes, query strings, emails, or bearer tokens.
  const path = logRoute(new URL(request.url).pathname);
  let response: Response;
  try {
    response = await dispatch(request, env, options.fetcher ?? fetch, (options.now ?? new Date()).toISOString());
  } catch (error) {
    if (error instanceof VersionConflict) response = json(409, { error: "State changed; reload or re-export before retrying" });
    else if (error instanceof OAuthInvalidState) response = json(409, { error: "Gmail authorization expired or was already used; start again" });
    else if (error instanceof OAuthRejected) response = json(403, { error: "Gmail authorization was denied or did not match the owner" });
    else if (error instanceof OAuthUnavailable) response = json(503, { error: "Gmail connection is unavailable; no token was acknowledged" });
    else if (error instanceof OversizedBody) response = json(413, { error: "Request is too large" });
    else if (error instanceof UnsupportedType) response = json(415, { error: "Expected application/json" });
    else if (error instanceof RangeError || error instanceof SyntaxError || error instanceof z.ZodError) response = json(400, { error: "Invalid request" });
    else response = json(503, { error: "Private storage is unavailable; no write was acknowledged" });
  }
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("X-Request-Id", requestId);
  const finished = new Response(response.body, { status: response.status, headers: responseHeaders });
  (options.log ?? console.log)(
    formatLog({
      level: finished.status >= 500 ? "error" : "info",
      msg: "recruitment request",
      requestId,
      method: request.method,
      path,
      status: finished.status,
      durationMs: Date.now() - started
    })
  );
  return finished;
}

export default { fetch: (request: Request, env: Env) => handleRequest(request, env) };

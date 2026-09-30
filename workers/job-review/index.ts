import { opportunitySnapshotSchema } from "../../src/features/jobs/opportunities";
import {
  OPPORTUNITY_ID_PATTERN,
  filterOpportunities,
  isStale,
  parseFilters,
  reviewStatuses,
  sanitizeNote,
  sortOpportunities,
  type ReviewMap,
  type ReviewStatus
} from "../../src/features/jobs/review";
import { verifyAccessJwt } from "./access";
import {
  PayloadTooLargeError,
  RateLimiter,
  UnsupportedMediaTypeError,
  fetchJsonBounded,
  formatLog,
  readFormBody,
  requestIdFor,
  type LogEntry
} from "../../src/shared/edge/platform";
import { renderPage } from "./render";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  JOBS_KV: KVLike;
  JOBS_DATA_URL: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ALLOWED_EMAIL?: string;
  /** Local development only; honoured solely for localhost requests. */
  DEV_AUTH_BYPASS?: string;
  /** "1" for preview versions, which share the production KV binding and therefore must never write to it. */
  READ_ONLY?: string;
  /** Short git SHA stamped at deploy time; reported by /healthz. */
  WORKER_VERSION?: string;
}

const REVIEWS_KEY = "reviews";

function baseHeaders(contentType = "text/html; charset=utf-8"): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    // "no-referrer" would make browsers send `Origin: null` on same-origin form POSTs, breaking the CSRF check.
    // "same-origin" still leaks nothing to other sites (external links also carry rel=noreferrer).
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    // CORS policy: this Worker serves exactly one same-origin UI and never any cross-origin caller, so it
    // sends NO Access-Control-Allow-* headers (browsers then block cross-origin reads) and adds these.
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin"
  };
}

function text(status: number, body: string) {
  return new Response(body, { status, headers: baseHeaders("text/plain; charset=utf-8") });
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const url = new URL(request.url);
  if (env.DEV_AUTH_BYPASS === "1" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALLOWED_EMAIL) return false;
  const email = await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUD,
    allowedEmail: env.ALLOWED_EMAIL
  });
  return email !== null;
}

type ReviewsResult = { ok: true; reviews: ReviewMap } | { ok: false };

/** Distinguishes "no reviews yet" from "could not read them": callers must never write after a failed read. */
async function loadReviews(env: Env): Promise<ReviewsResult> {
  try {
    const raw = await env.JOBS_KV.get(REVIEWS_KEY);
    return { ok: true, reviews: raw ? (JSON.parse(raw) as ReviewMap) : {} };
  } catch {
    return { ok: false };
  }
}

/**
 * The browser-set Origin must match this request's own host. Comparing against the Host header as
 * well as the URL keeps this correct behind proxies/dev servers that rewrite the request URL.
 */
export function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  if (!origin || origin === "null") return false;
  if (origin === url.origin) return true;
  try {
    const host = request.headers.get("Host");
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function safeReturnQuery(value: string | null) {
  // Re-serialise so only well-formed query parameters can ever end up in the redirect target.
  return new URLSearchParams(value ?? "").toString();
}

/** Route ownership: these are the only routes this Worker answers; everything else is 404/405. */
export const routes = [
  { method: "GET", path: "/", purpose: "Review UI (filters via query string)" },
  { method: "POST", path: "/review", purpose: "Save a review status/note (same-origin form post)" },
  { method: "GET", path: "/healthz", purpose: "Health and version, for smoke checks" }
] as const;

const allowedMethods = "GET, HEAD, POST";

// Best-effort, per-isolate limits (see RateLimiter). Access in front is the real access control.
export const limiters = { read: new RateLimiter(120, 60_000), write: new RateLimiter(30, 60_000) };

export interface HandlerOptions {
  fetcher?: typeof fetch;
  now?: Date;
  log?: (line: string) => void;
}

async function route(
  request: Request,
  env: Env,
  ctx: { requestId: string; fetcher: typeof fetch; now: Date; log: (entry: Omit<LogEntry, "requestId">) => void }
): Promise<Response> {
  const url = new URL(request.url);
  const { fetcher, now, log } = ctx;

  if (!(await isAuthorized(request, env))) return text(403, "Forbidden");

  // No CORS preflight support by design.
  if (request.method === "OPTIONS") return new Response(null, { status: 405, headers: { ...baseHeaders(), Allow: allowedMethods } });

  const client = request.headers.get("cf-connecting-ip") ?? "local";
  const limit = (request.method === "POST" ? limiters.write : limiters.read).check(`${request.method === "POST" ? "w" : "r"}:${client}`);
  if (!limit.allowed)
    return new Response("Too many requests", {
      status: 429,
      headers: { ...baseHeaders("text/plain; charset=utf-8"), "Retry-After": String(limit.retryAfterSeconds) }
    });

  const readOnly = env.READ_ONLY === "1";

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/healthz") {
    const kv = await loadReviews(env);
    const body = {
      status: kv.ok ? "ok" : "degraded",
      version: env.WORKER_VERSION ?? "dev",
      environment: readOnly ? "preview" : "production",
      kv: kv.ok ? "ok" : "unavailable",
      time: now.toISOString()
    };
    return new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
      status: kv.ok ? 200 : 503,
      headers: baseHeaders("application/json; charset=utf-8")
    });
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
    const filters = parseFilters(url.searchParams);
    const stored = await loadReviews(env);
    const reviews = stored.ok ? stored.reviews : {};
    const notices = [
      readOnly ? "Preview version: review changes are disabled so production data cannot be modified." : null,
      stored.ok ? null : "Saved reviews are temporarily unavailable; statuses and notes below may be missing."
    ].filter((notice): notice is string => notice !== null);
    if (!stored.ok) log({ level: "warn", msg: "review state unavailable" });

    try {
      const snapshot = opportunitySnapshotSchema.parse(await fetchJsonBounded(env.JOBS_DATA_URL, fetcher));
      const items = sortOpportunities(filterOpportunities(snapshot.opportunities, filters, reviews, now));
      const html = renderPage({
        items,
        allItems: snapshot.opportunities,
        filters,
        reviews,
        generatedAt: snapshot.generatedAt,
        stale: isStale(snapshot.generatedAt, now),
        returnQuery: url.searchParams.toString(),
        now,
        notices,
        readOnly
      });
      return new Response(request.method === "HEAD" ? null : html, { headers: baseHeaders() });
    } catch (error) {
      log({ level: "error", msg: "job data unavailable", error: error instanceof Error ? error.message : "unknown error" });
      return new Response(
        renderPage({
          items: [],
          allItems: [],
          filters,
          reviews,
          generatedAt: null,
          stale: false,
          returnQuery: "",
          now,
          notices,
          readOnly,
          error: "Job data is unavailable or failed validation. Try again shortly."
        }),
        { status: 502, headers: baseHeaders() }
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/review") {
    if (readOnly) return text(403, "This is a preview version; review changes are disabled");
    // Access cookies are SameSite=Lax, but require a same-origin Origin header as defence in depth.
    if (!isSameOrigin(request, url)) return text(403, "Cross-origin request rejected");

    let form: URLSearchParams;
    try {
      form = await readFormBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) return text(413, "Request body too large");
      if (error instanceof UnsupportedMediaTypeError) return text(415, "Unsupported content type");
      throw error;
    }

    const id = form.get("id") ?? "";
    const status = form.get("status") ?? "";
    if (!OPPORTUNITY_ID_PATTERN.test(id)) return text(400, "Invalid opportunity id");
    if (!(reviewStatuses as readonly string[]).includes(status)) return text(400, "Invalid status");

    // Never write after a failed read: that would replace every stored review with just this one.
    const stored = await loadReviews(env);
    if (!stored.ok) {
      log({ level: "error", msg: "refusing to save: review state unreadable" });
      return text(503, "Review state is temporarily unavailable; nothing was saved. Try again shortly.");
    }
    const reviews = stored.reviews;
    const note = sanitizeNote(form.get("note"));
    if (status === "new" && !note) delete reviews[id];
    else reviews[id] = { status: status as ReviewStatus, note, updatedAt: now.toISOString() };
    try {
      await env.JOBS_KV.put(REVIEWS_KEY, JSON.stringify(reviews));
    } catch {
      log({ level: "error", msg: "review write failed" });
      return text(503, "Review state is temporarily unavailable; nothing was saved. Try again shortly.");
    }

    const query = safeReturnQuery(form.get("return"));
    return new Response(null, { status: 303, headers: { ...baseHeaders(), Location: `/${query ? `?${query}` : ""}#job-${id}` } });
  }

  const known = routes.some((entry) => entry.path === url.pathname);
  if (known) return new Response("Method not allowed", { status: 405, headers: { ...baseHeaders("text/plain; charset=utf-8"), Allow: allowedMethods } });
  return text(404, "Not found");
}

/** Wraps routing with request identity, structured logging and a last-resort error boundary. */
export async function handleRequest(request: Request, env: Env, options: HandlerOptions = {}): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdFor(request);
  const emit = options.log ?? ((line: string) => console.log(line));
  const log = (entry: Omit<LogEntry, "requestId">) => emit(formatLog({ ...entry, requestId } as LogEntry));
  const path = new URL(request.url).pathname;

  let response: Response;
  try {
    response = await route(request, env, { requestId, fetcher: options.fetcher ?? fetch, now: options.now ?? new Date(), log });
  } catch (error) {
    log({ level: "error", msg: "unhandled error", error: error instanceof Error ? error.message : "unknown error" });
    response = text(500, "Internal error");
  }

  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  const finished = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  log({
    level: finished.status >= 500 ? "error" : "info",
    msg: "request",
    method: request.method,
    path,
    status: finished.status,
    durationMs: Date.now() - started,
    version: env.WORKER_VERSION ?? "dev"
  });
  return finished;
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env)
};

import { opportunitySnapshotSchema, type OpportunitySnapshot } from "../../lib/job-opportunities";
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
} from "../../lib/job-review";
import { verifyAccessJwt } from "./access";
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
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
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

async function loadSnapshot(env: Env, fetcher: typeof fetch): Promise<OpportunitySnapshot> {
  const response = await fetcher(env.JOBS_DATA_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Job data request failed (${response.status})`);
  return opportunitySnapshotSchema.parse(await response.json());
}

async function loadReviews(env: Env): Promise<ReviewMap> {
  try {
    const raw = await env.JOBS_KV.get(REVIEWS_KEY);
    return raw ? (JSON.parse(raw) as ReviewMap) : {};
  } catch {
    return {};
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

export async function handleRequest(request: Request, env: Env, options: { fetcher?: typeof fetch; now?: Date } = {}): Promise<Response> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const url = new URL(request.url);

  if (!(await isAuthorized(request, env))) return text(403, "Forbidden");

  if (request.method === "GET" && url.pathname === "/") {
    const filters = parseFilters(url.searchParams);
    const reviews = await loadReviews(env);
    try {
      const snapshot = await loadSnapshot(env, fetcher);
      const items = sortOpportunities(filterOpportunities(snapshot.opportunities, filters, reviews, now));
      return new Response(
        renderPage({
          items,
          allItems: snapshot.opportunities,
          filters,
          reviews,
          generatedAt: snapshot.generatedAt,
          stale: isStale(snapshot.generatedAt, now),
          returnQuery: url.searchParams.toString(),
          now
        }),
        { headers: baseHeaders() }
      );
    } catch (error) {
      console.error("job-review: failed to load job data", error instanceof Error ? error.message : "unknown error");
      return new Response(
        renderPage({
          items: [], allItems: [], filters, reviews, generatedAt: null, stale: false, returnQuery: "", now,
          error: "Job data is unavailable or failed validation. Try again shortly."
        }),
        { status: 502, headers: baseHeaders() }
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/review") {
    // Access cookies are SameSite=Lax, but require a same-origin Origin header as defence in depth.
    if (!isSameOrigin(request, url)) return text(403, "Cross-origin request rejected");

    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const status = String(form.get("status") ?? "");
    if (!OPPORTUNITY_ID_PATTERN.test(id)) return text(400, "Invalid opportunity id");
    if (!(reviewStatuses as readonly string[]).includes(status)) return text(400, "Invalid status");

    const reviews = await loadReviews(env);
    const note = sanitizeNote(form.get("note"));
    if (status === "new" && !note) delete reviews[id];
    else reviews[id] = { status: status as ReviewStatus, note, updatedAt: now.toISOString() };
    await env.JOBS_KV.put(REVIEWS_KEY, JSON.stringify(reviews));

    const query = safeReturnQuery(String(form.get("return") ?? ""));
    return new Response(null, { status: 303, headers: { ...baseHeaders(), Location: `/${query ? `?${query}` : ""}#job-${id}` } });
  }

  return text(404, "Not found");
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env)
};

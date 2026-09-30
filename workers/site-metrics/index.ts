import { aggregateKey, validateWireEvent } from "../../src/lib/telemetry/events";
import { formatLog, requestIdFor, type LogEntry } from "../../src/lib/edge/platform";
import { MAX_BODY_BYTES, RETENTION_SECONDS, limiter } from "./config";

/**
 * First-party, cookie-free event collector (issue #47). Runs on the Workers Free plan.
 *
 * What it stores: one integer per (UTC day, event, path, utm source/medium/campaign, referrer class,
 * allowed props). That is an aggregate counter. What it does NOT store or log: IP address, user agent,
 * cookies, any visitor or session identifier, timestamps finer than a day, or the request body.
 * The client IP is used only as an in-memory rate-limit key and is never persisted.
 */

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  METRICS_KV: KVLike;
  /** Comma-separated exact origins allowed to report (the production site). */
  ALLOWED_ORIGINS?: string;
  WORKER_VERSION?: string;
}

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS ?? "https://thavarshan.com").split(",").map((origin) => origin.trim()).filter(Boolean);
}

function baseHeaders(): Record<string, string> {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
}

function corsHeaders(origin: string): Record<string, string> {
  return { "Access-Control-Allow-Origin": origin, "Vary": "Origin" };
}

async function readTextLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

export interface HandlerOptions {
  now?: Date;
  log?: (line: string) => void;
}

export async function handleRequest(request: Request, env: Env, options: HandlerOptions = {}): Promise<Response> {
  const now = options.now ?? new Date();
  const requestId = requestIdFor(request);
  const emit = options.log ?? ((line: string) => console.log(line));
  // Logs carry an outcome and a request id only: never the body, the IP or any header value.
  const log = (entry: Omit<LogEntry, "requestId">) => emit(formatLog({ ...entry, requestId } as LogEntry));
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") ?? "";
  const originAllowed = allowedOrigins(env).includes(origin);

  const respond = (status: number, body: string | null = null, extra: Record<string, string> = {}) => {
    log({ level: status >= 500 ? "error" : "info", msg: "request", method: request.method, path: url.pathname, status });
    return new Response(body, { status, headers: { ...baseHeaders(), ...extra, "X-Request-Id": requestId } });
  };

  if (url.pathname === "/healthz" && request.method === "GET") {
    return respond(200, JSON.stringify({ status: "ok", version: env.WORKER_VERSION ?? "dev" }), { "Content-Type": "application/json" });
  }

  if (url.pathname !== "/collect") return respond(404, "Not found");

  if (request.method === "OPTIONS") {
    if (!originAllowed) return respond(403);
    return respond(204, null, { ...corsHeaders(origin), "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" });
  }
  if (request.method !== "POST") return respond(405, "Method not allowed", { Allow: "POST, OPTIONS" });
  if (!originAllowed) return respond(403);

  const cors = corsHeaders(origin);
  const decision = limiter.current.check(request.headers.get("cf-connecting-ip") ?? "local");
  if (!decision.allowed) return respond(429, null, { ...cors, "Retry-After": String(decision.retryAfterSeconds) });

  const text = await readTextLimited(request, MAX_BODY_BYTES);
  if (text === null) return respond(413, null, cors);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return respond(400, null, cors);
  }
  const checked = validateWireEvent(parsed);
  if (!checked.ok) return respond(400, null, cors);

  const key = aggregateKey(now.toISOString().slice(0, 10), checked.event);
  try {
    // Read-modify-write is not atomic; a rare lost increment under a race is acceptable for aggregate counts.
    const current = Number((await env.METRICS_KV.get(key)) ?? 0);
    await env.METRICS_KV.put(key, String(Number.isFinite(current) ? current + 1 : 1), { expirationTtl: RETENTION_SECONDS });
  } catch {
    // Free-plan KV limits or an outage: the event is dropped. Telemetry must never be able to hurt the site.
    return respond(503, null, cors);
  }
  return respond(204, null, cors);
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env)
};

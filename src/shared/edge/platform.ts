/**
 * Platform concerns shared by every route: request identity, structured logging, bounded input and
 * abuse limits. Kept free of Worker-only APIs so they are unit-testable in Node.
 */

export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_DATA_BYTES = 5 * 1024 * 1024;
export const DATA_FETCH_TIMEOUT_MS = 8_000;

export class PayloadTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor() {
    super("Expected application/x-www-form-urlencoded");
    this.name = "UnsupportedMediaTypeError";
  }
}

/** Correlates a request across logs and the response. Prefers Cloudflare's ray id, which support can look up. */
export function requestIdFor(request: Request, generate: () => string = () => crypto.randomUUID()): string {
  const ray = request.headers.get("cf-ray");
  return ray && /^[\w-]{8,64}$/.test(ray) ? ray : generate();
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  msg: string;
  requestId: string;
  [field: string]: unknown;
}

/** Fields that must never reach logs: user-entered notes, identities and credentials. */
const redactedKeys = new Set(["note", "email", "authorization", "cookie", "cf-access-jwt-assertion", "token"]);

/** One JSON line per event. Values under sensitive keys are dropped rather than masked. */
export function formatLog(entry: LogEntry): string {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (redactedKeys.has(key.toLowerCase())) continue;
    safe[key] = value;
  }
  return JSON.stringify(safe);
}

/** Reads a urlencoded form body with a hard byte cap, even when Content-Length is absent or wrong. */
export async function readFormBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/x-www-form-urlencoded")) throw new UnsupportedMediaTypeError();

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError(maxBytes);
  if (!request.body) return new URLSearchParams();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new URLSearchParams(new TextDecoder().decode(joined));
}

/** Fetches JSON with a timeout and a size cap, so a slow or hostile upstream cannot stall or exhaust the Worker. */
export async function fetchJsonBounded(url: string, fetcher: typeof fetch, options: { timeoutMs?: number; maxBytes?: number } = {}): Promise<unknown> {
  const { timeoutMs = DATA_FETCH_TIMEOUT_MS, maxBytes = MAX_DATA_BYTES } = options;
  const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Job data request failed (${response.status})`);

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Job data response is too large");
  }

  const text = await readBoundedText(response, maxBytes);
  if (!text.trim()) throw new Error("Job data response was empty");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Job data response was not valid JSON", { cause: error });
  }
}

/** Reads the body chunk by chunk, counting real bytes, and cancels the stream the moment the limit is exceeded. */
async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadLimitError();
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof PayloadLimitError) throw new Error("Job data response is too large", { cause: error });
    await reader.cancel().catch(() => undefined);
    throw new Error("Job data response was unreadable", { cause: error });
  }
}

class PayloadLimitError extends Error {}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Best-effort sliding-window limiter held in isolate memory. Workers isolates are ephemeral and not
 * shared across locations, so this bounds runaway loops and accidental hammering by the one
 * authorised user, NOT a determined attacker; Cloudflare Access in front is the real access control.
 * It deliberately uses no KV so it can never consume the free tier's 1,000 writes/day.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  check(key: string): RateLimitDecision {
    const current = this.now();
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => current - timestamp < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - current) / 1000)) };
    }
    recent.push(current);
    this.hits.set(key, recent);
    // Keep memory bounded if many distinct keys are ever seen.
    if (this.hits.size > 1000) for (const [k, stamps] of this.hits) if (stamps.every((t) => current - t >= this.windowMs)) this.hits.delete(k);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

import { RateLimiter } from "../job-review/platform";

/**
 * Constants and shared state live here, NOT in index.ts: the Workers runtime only accepts handlers as
 * exports from the entry module and refuses to start if it also exports plain values.
 */
export const MAX_BODY_BYTES = 1024;
export const RETENTION_SECONDS = 400 * 24 * 3600;

// Best-effort, per-isolate. Bounds a runaway page; it is not a defence against a determined abuser,
// whose worst case is exhausting the free plan's daily limits (errors, never a bill).
export const limiter = { current: new RateLimiter(120, 60_000) };

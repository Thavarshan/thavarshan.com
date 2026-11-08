/** Runtime-neutral async helpers shared by the automation pipelines (retry with backoff, bounded concurrency). */
export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  signal?: AbortSignal;
}

function delay(ms: number, signal?: AbortSignal) {
  if (!signal) return new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));
  return new Promise<void>((resolvePromise, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", aborted);
      resolvePromise();
    }
    function aborted() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      reject(signal?.reason);
    }
    signal.addEventListener("abort", aborted, { once: true });
  });
}

export async function withRetry<T>(task: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs = baseDelayMs * 8, isRetryable = () => true, signal } = opts;
  let attempt = 0;

  for (;;) {
    signal?.throwIfAborted();
    try {
      const result = await task();
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      signal?.throwIfAborted();
      attempt++;
      if (attempt > retries || !isRetryable(error)) throw error;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      await delay(jitter, signal);
    }
  }
}

export type SettledResult<R> = { status: "fulfilled"; value: R } | { status: "rejected"; reason: unknown };

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<SettledResult<R>[]> {
  const results: SettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    for (;;) {
      if (signal?.aborted) return;
      const index = cursor++;
      if (index >= items.length) return;
      if (signal?.aborted) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(runners);
  return results;
}

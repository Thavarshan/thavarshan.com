export class SkipEnrichmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipEnrichmentError";
  }
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

function delay(ms: number) {
  return new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));
}

export async function withRetry<T>(task: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs = baseDelayMs * 8, isRetryable = () => true } = opts;
  let attempt = 0;

  for (;;) {
    try {
      return await task();
    } catch (error) {
      attempt++;
      if (attempt > retries || !isRetryable(error)) throw error;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      await delay(jitter);
    }
  }
}

export type SettledResult<R> = { status: "fulfilled"; value: R } | { status: "rejected"; reason: unknown };

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<SettledResult<R>[]> {
  const results: SettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
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

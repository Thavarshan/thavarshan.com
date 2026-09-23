import { describe, expect, it, vi } from "vitest";
import { mapWithConcurrency, SkipEnrichmentError, withRetry } from "@/scripts/jobs/concurrency";

describe("mapWithConcurrency", () => {
  it("never exceeds the concurrency ceiling", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      inFlight--;
      return item * 2;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("settles every item exactly once, in order, even when some reject", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      if (item === 3) throw new Error("boom");
      return item * 10;
    });

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]).toEqual({ status: "fulfilled", value: 20 });
    expect(results[2].status).toBe("rejected");
    expect(results[3]).toEqual({ status: "fulfilled", value: 40 });
  });

  it("resolves immediately for empty input", async () => {
    const results = await mapWithConcurrency([], 4, async (item) => item);
    expect(results).toEqual([]);
  });
});

describe("withRetry", () => {
  it("succeeds after transient failures within the retry budget", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
      return "ok";
    }, { retries: 3, baseDelayMs: 10 });

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });

  it("exhausts retries and rethrows the last error", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      throw new Error(`fail-${attempts}`);
    }, { retries: 2, baseDelayMs: 10 });

    const assertion = expect(promise).rejects.toThrow("fail-3");
    await vi.runAllTimersAsync();
    await assertion;
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });

  it("does not retry a non-retryable error", async () => {
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      throw new SkipEnrichmentError("skip me");
    }, { retries: 5, baseDelayMs: 10, isRetryable: (error) => !(error instanceof SkipEnrichmentError) });

    await expect(promise).rejects.toThrow("skip me");
    expect(attempts).toBe(1);
  });
});

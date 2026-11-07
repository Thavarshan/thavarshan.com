import { describe, expect, it, vi } from "vitest";
import { mapWithConcurrency, withRetry } from "@/shared/node/async";
import { SkipEnrichmentError } from "@automation/jobs/concurrency";
import { enrichAndFinalize } from "@automation/jobs/enrichment";
import { SOURCE_BUDGET_MS, SOURCE_CLEANUP_MS } from "@automation/jobs/policy";
import type { BrowserContext, Page } from "@playwright/test";
import type { Opportunity } from "@/features/jobs/opportunities";

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

  it("stops taking queued work when its source is cancelled", async () => {
    const controller = new AbortController();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const opened: number[] = [];
    const pending = mapWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7, 8],
      2,
      async (item) => {
        opened.push(item);
        await gate;
        return item;
      },
      controller.signal
    );
    await Promise.resolve();
    controller.abort(new Error("expired"));
    release();
    await pending;
    expect(opened).toEqual([1, 2]);
  });

  it("cancels the actual enrichment queue before more browser pages open", async () => {
    const controller = new AbortController();
    let pagesOpened = 0;
    const fakePage = {
      goto: async () => new Promise<void>((resolve) => setTimeout(resolve, 25)),
      close: async () => undefined,
      waitForLoadState: async () => undefined,
      url: () => "https://careers.example/job"
    } as unknown as Page;
    const context = { newPage: async () => (pagesOpened++, fakePage) } as unknown as BrowserContext;
    const drafts = Array.from({ length: 8 }, (_, id) => ({ id }));
    const pending = enrichAndFinalize(
      context,
      drafts,
      () => "https://careers.example/job",
      () => ({ id: "unused" }) as unknown as Opportunity,
      { concurrency: 2, signal: controller.signal }
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort(new Error("source expired"));
    await expect(pending).rejects.toThrow("source expired");
    expect(pagesOpened).toBe(2);
  });

  it("reserves overall collection time for later sources and cleanup", () => {
    const budgets = Object.values(SOURCE_BUDGET_MS);
    expect(budgets).toHaveLength(4);
    expect(budgets.reduce((total, ms) => total + ms, 0) + budgets.length * SOURCE_CLEANUP_MS).toBeLessThan(12 * 60_000);
    expect(SOURCE_BUDGET_MS.remotive).toBeGreaterThan(0);
    expect(SOURCE_BUDGET_MS.weworkremotely).toBeGreaterThan(0);
  });
});

describe("withRetry", () => {
  it("abandons retry backoff immediately after cancellation", async () => {
    const controller = new AbortController();
    let attempts = 0;
    const pending = withRetry(
      async () => {
        attempts++;
        throw new Error("transient");
      },
      { retries: 5, baseDelayMs: 1_000, signal: controller.signal }
    );
    const asserted = expect(pending).rejects.toThrow("cancelled");
    await Promise.resolve();
    controller.abort(new Error("cancelled"));
    await asserted;
    expect(attempts).toBe(1);
  });
  it("succeeds after transient failures within the retry budget", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "ok";
      },
      { retries: 3, baseDelayMs: 10 }
    );

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });

  it("exhausts retries and rethrows the last error", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(
      async () => {
        attempts++;
        throw new Error(`fail-${attempts}`);
      },
      { retries: 2, baseDelayMs: 10 }
    );

    const assertion = expect(promise).rejects.toThrow("fail-3");
    await vi.runAllTimersAsync();
    await assertion;
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });

  it("does not retry a non-retryable error", async () => {
    let attempts = 0;
    const promise = withRetry(
      async () => {
        attempts++;
        throw new SkipEnrichmentError("skip me");
      },
      { retries: 5, baseDelayMs: 10, isRetryable: (error) => !(error instanceof SkipEnrichmentError) }
    );

    await expect(promise).rejects.toThrow("skip me");
    expect(attempts).toBe(1);
  });
});

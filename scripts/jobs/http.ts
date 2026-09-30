import type { APIRequestContext, APIResponse } from "@playwright/test";
import { SkipEnrichmentError } from "./concurrency";
import { REQUEST_TIMEOUT_MS, USER_AGENT, isRobotsExempt } from "./policy";
import type { RobotsGuard } from "./robots";
import type { Opportunity } from "../../lib/job-opportunities";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt does not permit fetching ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

/** The subset of Playwright's APIRequestContext the source adapters use; wrappers add robots + spacing + identity. */
export interface PoliteRequest {
  get(url: string, options?: { headers?: Record<string, string> }): Promise<APIResponse>;
}

/** Serialises request starts per host so no host is hit more often than `minIntervalMs`. */
export class HostThrottle {
  private readonly nextSlot = new Map<string, number>();

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ) {}

  async wait(host: string): Promise<void> {
    const current = this.now();
    const slot = Math.max(current, this.nextSlot.get(host) ?? 0);
    // Reserve the slot synchronously so concurrent callers queue behind each other.
    this.nextSlot.set(host, slot + this.minIntervalMs);
    if (slot > current) await this.sleep(slot - current);
  }
}

/** Returns a fetcher for robots.txt itself: identified, time-bounded and not subject to the guard it feeds. */
export function robotsFetcherFor(request: Pick<APIRequestContext, "get">) {
  return async (url: string) => {
    const response = await request.get(url, { headers: { "User-Agent": USER_AGENT }, timeout: 10_000, maxRedirects: 3 });
    return { status: response.status(), text: () => response.text() };
  };
}

export function createPoliteRequest(deps: {
  request: Pick<APIRequestContext, "get">;
  guard: RobotsGuard;
  throttle: HostThrottle;
  source: Opportunity["source"];
}): PoliteRequest {
  return {
    async get(url, options = {}) {
      if (!isRobotsExempt(deps.source, url) && !(await deps.guard.isAllowed(url))) throw new RobotsDisallowedError(url);
      await deps.throttle.wait(new URL(url).host);
      return deps.request.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": USER_AGENT, ...options.headers }
      });
    }
  };
}

const MAX_REDIRECT_HOPS = 5;

/**
 * Follows a board's redirect chain one hop at a time (HEAD, no body download), checking robots.txt
 * for every host BEFORE requesting it, and returns the final URL to open in the browser. Throws
 * SkipEnrichmentError, never a failure, when a hop is disallowed or the chain is unusable.
 */
export async function resolveRedirectTarget(
  url: string,
  deps: { request: Pick<APIRequestContext, "head">; guard: RobotsGuard; throttle: HostThrottle }
): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!(await deps.guard.isAllowed(current))) throw new SkipEnrichmentError(`robots.txt does not permit fetching ${current}`);
    await deps.throttle.wait(new URL(current).host);

    let response: APIResponse;
    try {
      response = await deps.request.head(current, { maxRedirects: 0, timeout: REQUEST_TIMEOUT_MS, headers: { "User-Agent": USER_AGENT } });
    } catch (error) {
      throw new SkipEnrichmentError(`could not resolve ${current}: ${error instanceof Error ? error.message : String(error)}`);
    }

    const status = response.status();
    const location = response.headers()["location"];
    if (status >= 300 && status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return current;
  }
  throw new SkipEnrichmentError(`too many redirects resolving ${url}`);
}

/** Rejects if `task` does not settle within `ms`, so one hung source cannot consume the whole run. */
export async function withDeadline<T>(label: string, ms: number, task: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded its ${Math.round(ms / 1000)}s deadline`)), ms);
  });
  try {
    return await Promise.race([task(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

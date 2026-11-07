import type { APIRequestContext, APIResponse, Page, Route } from "@playwright/test";
import { SkipEnrichmentError } from "./concurrency";
import { REQUEST_TIMEOUT_MS, USER_AGENT, isRobotsExempt } from "./policy";
import type { RobotsGuard } from "./robots";
import type { Opportunity } from "../../src/features/jobs/opportunities";

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

const MAX_REDIRECT_HOPS = 5;

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
  signal?: AbortSignal;
}): PoliteRequest {
  return {
    async get(url, options = {}) {
      let current = url;
      for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
        deps.signal?.throwIfAborted();
        if (!isRobotsExempt(deps.source, current) && !(await deps.guard.isAllowed(current))) throw new RobotsDisallowedError(current);
        deps.signal?.throwIfAborted();
        await deps.throttle.wait(new URL(current).host);
        deps.signal?.throwIfAborted();
        // Never allow Playwright to follow a GET redirect implicitly: its next host
        // and path might have different robots rules from the HEAD preflight.
        const response = await deps.request.get(current, {
          maxRedirects: 0,
          timeout: REQUEST_TIMEOUT_MS,
          headers: { "User-Agent": USER_AGENT, ...options.headers }
        });
        const status = response.status();
        const location = response.headers()["location"];
        if (status >= 300 && status < 400 && location) {
          current = new URL(location, current).toString();
          continue;
        }
        return response;
      }
      throw new Error(`Too many redirects fetching ${url}`);
    }
  };
}

/**
 * Follows a board's redirect chain one hop at a time (HEAD, no body download), checking robots.txt
 * for every host BEFORE requesting it, and returns the final URL to open in the browser. Throws
 * SkipEnrichmentError, never a failure, when a hop is disallowed or the chain is unusable.
 */
export async function resolveRedirectTarget(
  url: string,
  deps: { request: Pick<APIRequestContext, "head">; guard: RobotsGuard; throttle: HostThrottle; signal?: AbortSignal }
): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    deps.signal?.throwIfAborted();
    if (!(await deps.guard.isAllowed(current))) throw new SkipEnrichmentError(`robots.txt does not permit fetching ${current}`);
    deps.signal?.throwIfAborted();
    await deps.throttle.wait(new URL(current).host);
    deps.signal?.throwIfAborted();

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

/**
 * Intercepts a browser document GET before any content is fetched. Every actual GET redirect
 * is followed manually after checking robots + spacing. The browser receives the final body
 * via route.fulfill, so it never independently follows an unchecked navigation redirect.
 */
export async function navigateChecked(page: Page, url: string, deps: { guard: RobotsGuard; throttle: HostThrottle; signal?: AbortSignal }): Promise<string> {
  let landingUrl = url;
  let failure: unknown;
  const handler = async (route: Route) => {
    if (!route.request().isNavigationRequest()) {
      await route.continue();
      return;
    }
    let current = route.request().url();
    try {
      for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
        deps.signal?.throwIfAborted();
        if (!(await deps.guard.isAllowed(current))) throw new RobotsDisallowedError(current);
        deps.signal?.throwIfAborted();
        await deps.throttle.wait(new URL(current).host);
        deps.signal?.throwIfAborted();
        const response =
          hop === 0
            ? await route.fetch({ maxRedirects: 0 })
            : await page.context().request.get(current, {
                maxRedirects: 0,
                timeout: REQUEST_TIMEOUT_MS,
                headers: { "User-Agent": USER_AGENT }
              });
        const status = response.status();
        const location = response.headers()["location"];
        if (status >= 300 && status < 400 && location) {
          current = new URL(location, current).toString();
          continue;
        }
        landingUrl = current;
        await route.fulfill({ response });
        return;
      }
      throw new SkipEnrichmentError(`too many GET redirects navigating ${url}`);
    } catch (error) {
      failure = error;
      await route.abort("blockedbyclient").catch(() => undefined);
    }
  };

  // Keep the handler installed until the source-owned page closes: script-initiated
  // navigations after DOMContentLoaded must also pass the guard.
  await page.route("**/*", handler);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (error) {
    if (failure instanceof RobotsDisallowedError) throw new SkipEnrichmentError(failure.message);
    if (failure) throw failure;
    throw error;
  }
  if (failure) throw failure;
  return landingUrl;
}

/** Rejects if `task` does not settle within `ms`, so one hung source cannot consume the whole run. */
export async function withDeadline<T>(label: string, ms: number, task: () => Promise<T>, onTimeout?: () => void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`${label} exceeded its ${Math.round(ms / 1000)}s deadline`));
    }, ms);
  });
  try {
    return await Promise.race([task(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

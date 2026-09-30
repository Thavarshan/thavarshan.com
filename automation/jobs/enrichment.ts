import type { BrowserContext, Page } from "@playwright/test";
import type { Opportunity } from "../../src/features/jobs/opportunities";
import { mapWithConcurrency, withRetry } from "../../src/shared/node/async";
import { SkipEnrichmentError } from "./concurrency";

const unusableRedirectHosts = new Set(["accounts.google.com", "docs.google.com"]);

/**
 * Anti-bot challenges, region blocks and interstitials are not job postings. Scraping one must never yield a
 * title or description (they otherwise surface as e.g. a "job" called "Additional Verification Required").
 */
const botWallPattern =
  /_cf_chl_opt|cf-chl|Ray ID|Just a moment\.\.\.|Additional Verification Required|Enable JavaScript and cookies to continue|Attention Required|Access denied|Verify you are (?:a )?human|Checking your browser|(?:careers?|jobs?|this (?:site|page|content)|service) (?:is|are) not available in your|not available in your (?:region|country|location)|Region restriction|blocked in your (?:region|country)/i;

export function isUnusableScrape(scraped: { title: string | null; description: string }): boolean {
  return botWallPattern.test(scraped.title ?? "") || botWallPattern.test(scraped.description.slice(0, 2000));
}

/** Resolves a board link to its final URL, throwing SkipEnrichmentError when robots.txt or the chain forbids it. */
export type ResolveUrl = (url: string) => Promise<string>;

export interface ScrapedPage {
  title: string | null;
  description: string;
  /** Where the board's link actually landed (the employer/ATS page), after redirects. */
  finalUrl: string;
}

/**
 * Scrapes whatever page a job-board redirect lands on. Only LaraJobs redirects to arbitrary
 * external destinations (company career pages, ATSes, and occasionally an auth-wall) — every
 * other source hosts its own description directly and never needs this.
 */
export async function scrapeRedirectTarget(page: Page, url: string, resolveUrl: ResolveUrl = async (value) => value): Promise<ScrapedPage | null> {
  try {
    return await withRetry(
      async () => {
        // Resolve the redirect chain first so robots.txt is honoured for every host before it is requested.
        const target = await resolveUrl(url);
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
        // Single-page ATS sites render after DOMContentLoaded; give them a bounded moment to settle
        // so we capture the posting rather than a loading shell ("Apply for this job").
        await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
        if (unusableRedirectHosts.has(new URL(page.url()).hostname)) {
          throw new SkipEnrichmentError(`${url} redirects to an unusable auth-wall host`);
        }

        const title =
          (
            await page
              .locator("h1")
              .first()
              .textContent({ timeout: 10_000 })
              .catch(() => null)
          )?.trim() || (await page.title()).trim();
        const description =
          (await page
            .locator("main")
            .first()
            .textContent({ timeout: 10_000 })
            .catch(() => null)) ??
          (await page
            .locator("body")
            .textContent({ timeout: 10_000 })
            .catch(() => null)) ??
          "";

        const scraped = { title: title || null, description, finalUrl: page.url() };
        if (isUnusableScrape(scraped)) throw new SkipEnrichmentError(`${url} returned a bot-wall or challenge page`);
        return scraped;
      },
      { retries: 1, baseDelayMs: 750, isRetryable: (error) => !(error instanceof SkipEnrichmentError) }
    );
  } catch (error) {
    if (error instanceof SkipEnrichmentError) return null;
    throw error;
  }
}

/**
 * Runs `scrapeRedirectTarget` for every draft with bounded concurrency, then hands the result
 * (or `null` on any failure/skip) to `finalize`. Every draft always produces an Opportunity —
 * a failed or skipped scrape only means a missing supplemental description, never a lost record.
 */
export async function enrichAndFinalize<D>(
  context: BrowserContext,
  drafts: D[],
  getUrl: (draft: D) => string,
  finalize: (draft: D, now: string, scrapedDescription: string | null, applicationUrl: string | null) => Opportunity,
  opts: { concurrency: number; resolveUrl?: ResolveUrl },
  now = new Date().toISOString()
): Promise<Opportunity[]> {
  const results = await mapWithConcurrency(drafts, opts.concurrency, async (draft) => {
    const page = await context.newPage();
    try {
      const scraped = await scrapeRedirectTarget(page, getUrl(draft), opts.resolveUrl);
      return finalize(draft, now, scraped?.description ?? null, scraped?.finalUrl ?? null);
    } finally {
      await page.close();
    }
  });

  return results.map((result, index) => (result.status === "fulfilled" ? result.value : finalize(drafts[index], now, null, null)));
}

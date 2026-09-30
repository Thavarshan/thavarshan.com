import type { BrowserContext, Page } from "@playwright/test";
import type { Opportunity } from "../../lib/job-opportunities";
import { mapWithConcurrency, SkipEnrichmentError, withRetry } from "./concurrency";

const unusableRedirectHosts = new Set(["accounts.google.com", "docs.google.com"]);

/**
 * Anti-bot challenges and interstitials are not job postings. Scraping one must never yield a
 * title or description (they otherwise surface as e.g. a "job" called "Additional Verification Required").
 */
const botWallPattern =
  /_cf_chl_opt|cf-chl|Ray ID|Just a moment\.\.\.|Additional Verification Required|Enable JavaScript and cookies to continue|Attention Required|Access denied|Verify you are (?:a )?human|Checking your browser/i;

export function isUnusableScrape(scraped: { title: string | null; description: string }): boolean {
  return botWallPattern.test(scraped.title ?? "") || botWallPattern.test(scraped.description.slice(0, 2000));
}

export interface ScrapedPage {
  title: string | null;
  description: string;
}

/**
 * Scrapes whatever page a job-board redirect lands on. Only LaraJobs redirects to arbitrary
 * external destinations (company career pages, ATSes, and occasionally an auth-wall) — every
 * other source hosts its own description directly and never needs this.
 */
export async function scrapeRedirectTarget(page: Page, url: string): Promise<ScrapedPage | null> {
  try {
    return await withRetry(
      async () => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        if (unusableRedirectHosts.has(new URL(page.url()).hostname)) {
          throw new SkipEnrichmentError(`${url} redirects to an unusable auth-wall host`);
        }

        const title =
          (await page.locator("h1").first().textContent({ timeout: 10_000 }).catch(() => null))?.trim() ||
          (await page.title()).trim();
        const description =
          (await page.locator("main").first().textContent({ timeout: 10_000 }).catch(() => null)) ??
          (await page.locator("body").textContent({ timeout: 10_000 }).catch(() => null)) ??
          "";

        const scraped = { title: title || null, description };
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
  finalize: (draft: D, now: string, scrapedDescription: string | null) => Opportunity,
  opts: { concurrency: number },
  now = new Date().toISOString()
): Promise<Opportunity[]> {
  const results = await mapWithConcurrency(drafts, opts.concurrency, async (draft) => {
    const page = await context.newPage();
    try {
      const scraped = await scrapeRedirectTarget(page, getUrl(draft));
      return finalize(draft, now, scraped?.description ?? null);
    } finally {
      await page.close();
    }
  });

  return results.map((result, index) => (result.status === "fulfilled" ? result.value : finalize(drafts[index], now, null)));
}

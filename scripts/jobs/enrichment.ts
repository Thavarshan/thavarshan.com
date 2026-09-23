import type { BrowserContext, Page } from "@playwright/test";
import type { Opportunity } from "../../lib/job-opportunities";
import { mapWithConcurrency, SkipEnrichmentError, withRetry } from "./concurrency";

const unusableRedirectHosts = new Set(["accounts.google.com", "docs.google.com"]);

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

        return { title: title || null, description };
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

/**
 * Same primitive as {@link enrichAndFinalize}, but for bare links with no source metadata at
 * all (both title and description come from the scrape itself) — a scrape failure/skip/empty
 * title here means the link is dropped, not just missing a description.
 */
export async function enrichUnknownLinks(
  context: BrowserContext,
  urls: string[],
  buildFromScrape: (url: string, title: string, description: string, now: string) => Opportunity,
  opts: { concurrency: number },
  now = new Date().toISOString()
): Promise<{ opportunities: Opportunity[]; rejected: number }> {
  const results = await mapWithConcurrency(urls, opts.concurrency, async (url) => {
    const page = await context.newPage();
    try {
      const scraped = await scrapeRedirectTarget(page, url);
      if (!scraped?.title) return null;
      return buildFromScrape(url, scraped.title, scraped.description, now);
    } finally {
      await page.close();
    }
  });

  const opportunities: Opportunity[] = [];
  let rejected = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) opportunities.push(result.value);
    } else {
      rejected++;
    }
  }

  return { opportunities, rejected };
}

import type { Page } from "@playwright/test";
import { canonicalizeJobUrl, type Opportunity, type SourceCollectionSuccess } from "../../../lib/job-opportunities";
import { buildOpportunity } from "../opportunity-builder";

export const laravelNewsUrl = "https://laravel-news.com/";

const unusableRedirectHosts = new Set(["accounts.google.com", "docs.google.com"]);

export async function collectLaravelNewsLinks(page: Page): Promise<string[]> {
  await page.goto(laravelNewsUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  return page.locator('a[href*="larajobs.com/job/"]').evaluateAll((anchors) =>
    [...new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean))]
  );
}

async function scrapeLink(page: Page, canonicalUrl: string, now: string): Promise<Opportunity | null> {
  await page.goto(canonicalUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (unusableRedirectHosts.has(new URL(page.url()).hostname)) return null;

  const title =
    (await page.locator("h1").first().textContent({ timeout: 10_000 }).catch(() => null))?.trim() ||
    (await page.title()).trim();
  const description =
    (await page.locator("main").first().textContent({ timeout: 10_000 }).catch(() => null)) ??
    (await page.locator("body").textContent({ timeout: 10_000 }).catch(() => null)) ??
    "";

  if (!title) return null;
  return buildOpportunity({ title, url: canonicalUrl, sourceUrl: laravelNewsUrl, description, source: "laravel-news" }, now);
}

export async function collectLaravelNews(page: Page, known: Set<string>, now = new Date().toISOString()): Promise<SourceCollectionSuccess> {
  const links = await collectLaravelNewsLinks(page);
  const opportunities: Opportunity[] = [];
  let rejected = 0;

  for (const link of links.slice(0, 20)) {
    const canonicalUrl = canonicalizeJobUrl(link);
    if (known.has(canonicalUrl)) continue;
    try {
      const opportunity = await scrapeLink(page, canonicalUrl, now);
      if (opportunity) opportunities.push(opportunity);
    } catch (error) {
      rejected++;
      console.warn(`Skipping ${canonicalUrl}: ${error instanceof Error ? error.message : error}`);
    }
    await page.waitForTimeout(350);
  }

  return { source: "laravel-news", opportunities, skipped: 0, rejected };
}

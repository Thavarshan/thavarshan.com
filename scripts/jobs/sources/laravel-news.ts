import type { Page } from "@playwright/test";
import { canonicalizeJobUrl } from "../../../lib/job-opportunities";

export const laravelNewsUrl = "https://laravel-news.com/";

export interface LaravelNewsRawLink {
  href: string;
  title: string | null;
  company: string | null;
}

export interface LaravelNewsDraft {
  canonicalUrl: string;
  title: string;
  company: string | null;
}

/**
 * Laravel News lists each job as an anchor with the title and company in separate spans. That
 * listing is the authoritative title/company: the page the link ultimately redirects to is an
 * arbitrary third-party site whose <h1> may be a cookie banner, bot wall or marketing headline.
 */
export function normalizeLaravelNewsLinks(links: LaravelNewsRawLink[]): LaravelNewsDraft[] {
  const drafts = new Map<string, LaravelNewsDraft>();
  for (const link of links) {
    const title = link.title?.replace(/\s+/g, " ").trim();
    if (!title) continue;
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeJobUrl(link.href);
    } catch {
      continue;
    }
    if (!drafts.has(canonicalUrl)) {
      drafts.set(canonicalUrl, { canonicalUrl, title, company: link.company?.replace(/\s+/g, " ").trim() || null });
    }
  }
  return [...drafts.values()];
}

export const laravelNewsJobSelector = 'a[href*="larajobs.com/job/"]';

/**
 * Runs in the browser via `evaluateAll`, so it must stay self-contained (no imports or closures).
 * Exported so tests can run the identical function against captured real markup.
 */
export function extractLaravelNewsAnchors(anchors: Element[]): LaravelNewsRawLink[] {
  return anchors.map((anchor) => {
    const spans = [...anchor.querySelectorAll("span")].map((span) => span.textContent?.trim() ?? "").filter(Boolean);
    return { href: (anchor as HTMLAnchorElement).href, title: spans[0] ?? null, company: spans[1] ?? null };
  });
}

export async function collectLaravelNewsLinks(page: Page): Promise<LaravelNewsDraft[]> {
  await page.goto(laravelNewsUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const raw = await page.locator(laravelNewsJobSelector).evaluateAll(extractLaravelNewsAnchors);
  return normalizeLaravelNewsLinks(raw);
}

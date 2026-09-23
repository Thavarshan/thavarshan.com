import type { APIRequestContext } from "@playwright/test";
import type { Opportunity, SourceCollectionSuccess } from "../../../lib/job-opportunities";
import { withRetry } from "../concurrency";
import { buildOpportunity, isLaravelPhpRelevant } from "../opportunity-builder";
import { safeDate, stripHtml, xmlItems, xmlValue } from "../xml";

export const weWorkRemotelyUrl = "https://weworkremotely.com/categories/remote-programming-jobs.rss";

export function splitWwrTitle(value: string): { title: string; company: string | null } {
  const index = value.indexOf(": ");
  if (index <= 0) return { title: value.trim(), company: null };
  return { title: value.slice(index + 2).trim(), company: value.slice(0, index).trim() || null };
}

export function parseWeWorkRemotelyFeed(xml: string, now = new Date().toISOString()) {
  const items = xmlItems(xml);
  if (items.length === 0) {
    throw new Error("WeWorkRemotely feed returned zero items — the feed format may have changed");
  }

  const opportunities: Opportunity[] = [];
  let skipped = 0;
  let rejected = 0;

  for (const item of items) {
    try {
      const link = xmlValue(item, "link");
      const rawTitle = xmlValue(item, "title");
      if (!link || !rawTitle) {
        rejected++;
        continue;
      }

      const { title, company } = splitWwrTitle(rawTitle);
      const description = stripHtml(xmlValue(item, "description"));

      if (!isLaravelPhpRelevant({ title, tags: [], category: null }) && !/\b(laravel|php)\b/i.test(description)) {
        skipped++;
        continue;
      }

      opportunities.push(buildOpportunity({
        title,
        company,
        url: link,
        sourceUrl: weWorkRemotelyUrl,
        description,
        publishedAt: safeDate(xmlValue(item, "pubDate")),
        source: "weworkremotely",
        location: xmlValue(item, "region") || null
      }, now));
    } catch {
      rejected++;
    }
  }

  return { opportunities, skipped, rejected };
}

export async function collectWeWorkRemotely(request: APIRequestContext, now = new Date().toISOString()): Promise<SourceCollectionSuccess> {
  const response = await withRetry(
    () => request.get(weWorkRemotelyUrl, { headers: { Accept: "application/rss+xml, application/xml;q=0.9" } }),
    { retries: 2, baseDelayMs: 500 }
  );
  if (!response.ok()) throw new Error(`WeWorkRemotely feed returned ${response.status()}`);
  const { opportunities, skipped, rejected } = parseWeWorkRemotelyFeed(await response.text(), now);
  return { source: "weworkremotely", opportunities, skipped, rejected };
}

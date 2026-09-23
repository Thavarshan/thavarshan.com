import type { APIRequestContext } from "@playwright/test";
import type { Opportunity, SourceCollectionSuccess } from "../../../lib/job-opportunities";
import { buildOpportunity, normalizeJobType, splitTitle } from "../opportunity-builder";
import { safeDate, xmlItems, xmlValue } from "../xml";

export const laraJobsFeedUrl = "https://larajobs.com/feed";

export interface LaraJobsDraft {
  title: string;
  company: string | null;
  canonicalUrl: string;
  location: string | null;
  employmentType: string | null;
  salary: string | null;
  feedTags: string[];
  feedDescription: string;
  publishedAt: string | null;
}

export function parseLaraJobsFeedItems(xml: string): LaraJobsDraft[] {
  return xmlItems(xml).flatMap((item) => {
    const link = xmlValue(item, "link");
    const rawTitle = xmlValue(item, "title");
    if (!link || !rawTitle || !/larajobs\.com\/job\//i.test(link)) return [];

    const feedCompany = xmlValue(item, "job:company") || null;
    const { title, company } = feedCompany ? { title: rawTitle, company: feedCompany } : splitTitle(rawTitle);
    const feedTags = xmlValue(item, "job:tags");

    return [{
      title,
      company,
      canonicalUrl: link,
      location: xmlValue(item, "job:location") || null,
      employmentType: normalizeJobType(xmlValue(item, "job:job_type")),
      salary: xmlValue(item, "job:salary") || null,
      feedTags: feedTags ? feedTags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      feedDescription: xmlValue(item, "content:encoded") || xmlValue(item, "description"),
      publishedAt: safeDate(xmlValue(item, "pubDate"))
    }];
  });
}

export function finalizeLaraJobsDraft(draft: LaraJobsDraft, now: string, scrapedDescription?: string | null): Opportunity {
  return buildOpportunity({
    title: draft.title,
    company: draft.company,
    url: draft.canonicalUrl,
    sourceUrl: laraJobsFeedUrl,
    description: scrapedDescription || draft.feedDescription,
    publishedAt: draft.publishedAt,
    source: "larajobs",
    location: draft.location,
    employmentType: draft.employmentType,
    salary: draft.salary,
    feedTags: draft.feedTags
  }, now);
}

export function parseLaraJobsFeed(xml: string, now = new Date().toISOString()): Opportunity[] {
  return parseLaraJobsFeedItems(xml).map((draft) => finalizeLaraJobsDraft(draft, now));
}

export async function collectLaraJobsDrafts(request: APIRequestContext): Promise<LaraJobsDraft[]> {
  const response = await request.get(laraJobsFeedUrl, { headers: { Accept: "application/rss+xml, application/xml;q=0.9" } });
  if (!response.ok()) throw new Error(`LaraJobs feed returned ${response.status()}`);
  const drafts = parseLaraJobsFeedItems(await response.text());
  if (drafts.length === 0) throw new Error("LaraJobs feed returned zero parsable items — the feed format may have changed");
  return drafts;
}

export async function collectLaraJobs(request: APIRequestContext, now = new Date().toISOString()): Promise<SourceCollectionSuccess> {
  const drafts = await collectLaraJobsDrafts(request);
  return {
    source: "larajobs",
    opportunities: drafts.map((draft) => finalizeLaraJobsDraft(draft, now)),
    skipped: 0,
    rejected: 0
  };
}

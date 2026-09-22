import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type APIRequestContext, type Page } from "@playwright/test";
import {
  assessOpportunity,
  canonicalizeJobUrl,
  mergeOpportunities,
  opportunityId,
  opportunitySnapshotSchema,
  type Opportunity,
  type OpportunitySnapshot
} from "../../lib/job-opportunities";
import { writeJsonAtomic } from "../profile/io";

const outputPath = resolve("data/jobs.generated.json");
const laraJobsFeed = "https://larajobs.com/feed";
const laravelNewsUrl = "https://laravel-news.com/";
const userAgent = "JeromeJobCollector/1.0 (+https://thavarshan.com)";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

function xmlValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function safeDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitTitle(value: string) {
  const separators = [" at ", " – ", " — ", " - "];
  for (const separator of separators) {
    const index = value.lastIndexOf(separator);
    if (index > 0) return { title: value.slice(0, index).trim(), company: value.slice(index + separator.length).trim() || null };
  }
  return { title: value.trim(), company: null };
}

function buildOpportunity(input: {
  title: string;
  company?: string | null;
  url: string;
  description?: string;
  publishedAt?: string | null;
  source: Opportunity["source"];
}, now: string): Opportunity {
  const canonicalUrl = canonicalizeJobUrl(input.url);
  const descriptionText = stripHtml(input.description ?? "");
  const tags = [...new Set((`${input.title} ${descriptionText}`.match(/\b(?:Laravel|PHP|React|Vue(?:\.js)?|Inertia|Livewire|AWS|MySQL|Postgres|Redis|Docker|Kubernetes|Tailwind)\b/gi) ?? []).map((tag) => tag.toLowerCase()))];
  const assessment = assessOpportunity({ title: input.title, descriptionText, location: null, tags });

  return {
    id: opportunityId(canonicalUrl),
    source: input.source,
    sourceUrl: input.source === "laravel-news" ? laravelNewsUrl : laraJobsFeed,
    canonicalUrl,
    title: input.title,
    company: input.company ?? null,
    location: null,
    employmentType: null,
    salary: null,
    descriptionText,
    tags,
    publishedAt: input.publishedAt ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    ...assessment
  };
}

export function parseLaraJobsFeed(xml: string, now = new Date().toISOString()) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const link = xmlValue(item, "link");
    const rawTitle = xmlValue(item, "title");
    if (!link || !rawTitle || !/larajobs\.com\/job\//i.test(link)) return [];
    const { title, company } = splitTitle(rawTitle);
    return [buildOpportunity({
      title,
      company,
      url: link,
      description: xmlValue(item, "content:encoded") || xmlValue(item, "description"),
      publishedAt: safeDate(xmlValue(item, "pubDate")),
      source: "larajobs"
    }, now)];
  });
}

async function collectLaraJobs(request: APIRequestContext) {
  const response = await request.get(laraJobsFeed, { headers: { Accept: "application/rss+xml, application/xml;q=0.9" } });
  if (!response.ok()) throw new Error(`LaraJobs feed returned ${response.status()}`);
  return parseLaraJobsFeed(await response.text());
}

async function collectLaravelNewsLinks(page: Page) {
  await page.goto(laravelNewsUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  return page.locator('a[href*="larajobs.com/job/"]').evaluateAll((anchors) =>
    [...new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean))]
  );
}

const unusableRedirectHosts = new Set(["accounts.google.com", "docs.google.com"]);

async function enrichLaravelNewsOnlyLinks(page: Page, links: string[], known: Set<string>) {
  const records: Opportunity[] = [];
  for (const link of links.slice(0, 20)) {
    const canonicalUrl = canonicalizeJobUrl(link);
    if (known.has(canonicalUrl)) continue;
    try {
      await page.goto(canonicalUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (unusableRedirectHosts.has(new URL(page.url()).hostname)) continue;

      const title =
        (await page.locator("h1").first().textContent({ timeout: 10_000 }).catch(() => null))?.trim() ||
        (await page.title()).trim();
      const description =
        (await page.locator("main").first().textContent({ timeout: 10_000 }).catch(() => null)) ??
        (await page.locator("body").textContent({ timeout: 10_000 }).catch(() => null)) ??
        "";
      if (title) records.push(buildOpportunity({ title, url: canonicalUrl, description, source: "laravel-news" }, new Date().toISOString()));
    } catch (error) {
      console.warn(`Skipping ${canonicalUrl}: ${error instanceof Error ? error.message : error}`);
    }
    await page.waitForTimeout(350);
  }
  return records;
}

async function readExisting(): Promise<OpportunitySnapshot | null> {
  try {
    return opportunitySnapshotSchema.parse(JSON.parse(await readFile(outputPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function collectJobs() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    const collectedAt = new Date().toISOString();
    const laraJobs = await collectLaraJobs(context.request);
    const laravelNewsLinks = await collectLaravelNewsLinks(page);
    const known = new Set(laraJobs.map((item) => item.canonicalUrl));
    const laravelNewsOnly = await enrichLaravelNewsOnlyLinks(page, laravelNewsLinks, known);
    const existing = await readExisting();

    const snapshot = opportunitySnapshotSchema.parse({
      schemaVersion: 1,
      generatedAt: collectedAt,
      candidate: {
        location: "Sri Lanka",
        preferredStack: ["Laravel", "PHP", "React", "Vue", "Inertia", "AWS"],
        experienceYears: 11,
        workModes: ["remote", "relocation-with-sponsorship"]
      },
      sources: [
        { name: "LaraJobs RSS", url: laraJobsFeed, collectedAt, recordsFound: laraJobs.length },
        { name: "Laravel News", url: laravelNewsUrl, collectedAt, recordsFound: laravelNewsLinks.length }
      ],
      opportunities: mergeOpportunities(existing?.opportunities ?? [], [...laraJobs, ...laravelNewsOnly])
    });

    await writeJsonAtomic(outputPath, snapshot);
    console.log(`Updated ${outputPath} with ${snapshot.opportunities.length} ranked opportunities`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectJobs().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

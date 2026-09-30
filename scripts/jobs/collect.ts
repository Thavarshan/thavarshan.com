import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import {
  mergeOpportunities,
  opportunitySnapshotSchema,
  type Opportunity,
  type OpportunitySnapshot,
  type SourceCollectionOutcome
} from "../../lib/job-opportunities";
import { loadSnapshot } from "../../lib/job-snapshot";
import { writeJsonAtomic } from "../profile/io";
import { recordSourceFailure } from "./diagnostics";
import { enrichAndFinalize } from "./enrichment";
import { buildOpportunity } from "./opportunity-builder";
import { collectLaraJobsDrafts, finalizeLaraJobsDraft, laraJobsFeedUrl } from "./sources/larajobs";
import { collectLaravelNewsLinks, laravelNewsUrl } from "./sources/laravel-news";
import { collectRemotiveJobs, remotiveUrl } from "./sources/remotive";
import { collectWeWorkRemotely, weWorkRemotelyUrl } from "./sources/weworkremotely";

export { parseLaraJobsFeed } from "./sources/larajobs";

const outputPath = resolve("data/jobs.generated.json");
const userAgent = "JeromeJobCollector/1.0 (+https://thavarshan.com)";
const ENRICHMENT_CONCURRENCY = 4;

const sourceMeta: Record<Opportunity["source"], { name: string; url: string }> = {
  larajobs: { name: "LaraJobs RSS", url: laraJobsFeedUrl },
  "laravel-news": { name: "Laravel News", url: laravelNewsUrl },
  remotive: { name: "Remotive", url: remotiveUrl },
  weworkremotely: { name: "WeWorkRemotely", url: weWorkRemotelyUrl }
};

/**
 * The committed snapshot is the last-known-good state. An unreadable one must fail the run rather
 * than silently start fresh (which would discard history and bypass the collapse guard below).
 * Set JOBS_RESET_SNAPSHOT=1 to deliberately start over.
 */
export async function readExisting(path = outputPath, allowReset = process.env.JOBS_RESET_SNAPSHOT === "1"): Promise<OpportunitySnapshot | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  try {
    const { snapshot, migratedFrom } = loadSnapshot(JSON.parse(raw));
    if (migratedFrom !== null) console.log(`Migrated existing snapshot from schemaVersion ${migratedFrom} to ${snapshot.schemaVersion}.`);
    return snapshot;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (allowReset) {
      console.warn(`Existing ${path} is unusable (${reason}); starting fresh because JOBS_RESET_SNAPSHOT=1.`);
      return null;
    }
    throw new Error(`Refusing to overwrite unusable ${path}: ${reason}. Fix or restore it, or set JOBS_RESET_SNAPSHOT=1 to start over.`, { cause: error });
  }
}

async function appendStepSummary(sources: OpportunitySnapshot["sources"], opportunities: Opportunity[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const sourceRows = sources.map((source) =>
    `| ${source.name} | ${source.status} | ${source.recordsFound} | ${source.added} | ${source.updated} | ${source.closed} | ${source.skipped} | ${source.rejected} |`
  );
  const top = opportunities
    .filter((item) => item.status !== "closed")
    .slice(0, 5)
    .map((item) => `- **${item.score}** ${item.title} @ ${item.company ?? "Unknown"} (${item.eligibility})`);

  const lines = [
    "## Laravel jobs refresh",
    "",
    "| Source | Status | Records | Added | Updated | Closed | Skipped | Rejected |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...sourceRows,
    "",
    "### Top 5 by score",
    ...(top.length > 0 ? top : ["_None_"])
  ];

  await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

export async function collectJobs() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent });
    const discoveryPage = await context.newPage();
    const now = new Date().toISOString();
    const existing = await readExisting();

    const results: SourceCollectionOutcome[] = [];
    let laraJobsCanonicalUrls = new Set(
      (existing?.opportunities ?? []).filter((item) => item.source === "larajobs").map((item) => item.canonicalUrl)
    );

    try {
      const drafts = await collectLaraJobsDrafts(context.request);
      const opportunities = await enrichAndFinalize(
        context,
        drafts,
        (draft) => draft.canonicalUrl,
        (draft, finalizeNow, scrapedDescription) => finalizeLaraJobsDraft(draft, finalizeNow, scrapedDescription),
        { concurrency: ENRICHMENT_CONCURRENCY },
        now
      );
      results.push({ source: "larajobs", opportunities, skipped: 0, rejected: 0 });
      laraJobsCanonicalUrls = new Set([...laraJobsCanonicalUrls, ...opportunities.map((item) => item.canonicalUrl)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`LaraJobs collection failed: ${message}`);
      await recordSourceFailure("larajobs", error, discoveryPage);
      results.push({ source: "larajobs", failed: true, error: message });
    }

    try {
      const drafts = (await collectLaravelNewsLinks(discoveryPage))
        .filter((draft) => !laraJobsCanonicalUrls.has(draft.canonicalUrl))
        .slice(0, 20);
      // Title/company come from Laravel News's own listing; the scrape only supplies description text.
      const opportunities = await enrichAndFinalize(
        context,
        drafts,
        (draft) => draft.canonicalUrl,
        (draft, finalizeNow, scrapedDescription) =>
          buildOpportunity(
            {
              title: draft.title,
              company: draft.company,
              url: draft.canonicalUrl,
              sourceUrl: laravelNewsUrl,
              description: scrapedDescription ?? undefined,
              source: "laravel-news"
            },
            finalizeNow
          ),
        { concurrency: ENRICHMENT_CONCURRENCY },
        now
      );
      results.push({ source: "laravel-news", opportunities, skipped: 0, rejected: 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Laravel News collection failed: ${message}`);
      await recordSourceFailure("laravel-news", error, discoveryPage);
      results.push({ source: "laravel-news", failed: true, error: message });
    }

    try {
      results.push(await collectRemotiveJobs(context.request, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Remotive collection failed: ${message}`);
      await recordSourceFailure("remotive", error);
      results.push({ source: "remotive", failed: true, error: message });
    }

    try {
      results.push(await collectWeWorkRemotely(context.request, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`WeWorkRemotely collection failed: ${message}`);
      await recordSourceFailure("weworkremotely", error);
      results.push({ source: "weworkremotely", failed: true, error: message });
    }

    const { opportunities, stats } = mergeOpportunities(existing?.opportunities ?? [], results, now);

    const sources = results.map((result) => {
      const meta = sourceMeta[result.source];
      const stat = stats[result.source] ?? { added: 0, updated: 0, unchanged: 0, closed: 0, pruned: 0 };
      const failed = "failed" in result;
      return {
        name: meta.name,
        url: meta.url,
        collectedAt: now,
        status: failed ? ("failed" as const) : ("ok" as const),
        recordsFound: failed ? 0 : result.opportunities.length,
        added: stat.added,
        updated: stat.updated,
        closed: stat.closed,
        skipped: failed ? 0 : result.skipped,
        rejected: failed ? 0 : result.rejected,
        error: failed ? result.error : null
      };
    });

    const previousOpenCount = (existing?.opportunities ?? []).filter((item) => item.status !== "closed").length;
    const nextOpenCount = opportunities.filter((item) => item.status !== "closed").length;
    if (previousOpenCount >= 20 && nextOpenCount < Math.ceil(previousOpenCount * 0.25)) {
      throw new Error(
        `Refusing to publish suspicious job snapshot: open opportunities collapsed from ${previousOpenCount} to ${nextOpenCount}`
      );
    }

    const snapshot = opportunitySnapshotSchema.parse({
      schemaVersion: 2,
      generatedAt: now,
      candidate: {
        location: "Sri Lanka",
        preferredStack: ["Laravel", "PHP", "React", "Vue", "Inertia", "AWS"],
        experienceYears: 11,
        workModes: ["remote", "relocation-with-sponsorship"]
      },
      sources,
      opportunities
    });

    await writeJsonAtomic(outputPath, snapshot);
    await appendStepSummary(snapshot.sources, snapshot.opportunities);
    console.log(`Updated ${outputPath} with ${snapshot.opportunities.length} opportunities across ${sources.length} sources`);

    if (results.some((result) => "failed" in result)) {
      process.exitCode = 1;
    }
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

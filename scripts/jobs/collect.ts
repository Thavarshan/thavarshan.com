import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  COLLECTOR_VERSION,
  mergeOpportunities,
  opportunitySnapshotSchema,
  type Opportunity,
  type OpportunitySnapshot,
  type SourceCollectionOutcome,
  type SourceCollectionSuccess
} from "../../src/lib/job-opportunities";
import { loadSnapshot } from "../../src/lib/job-snapshot";
import { writeJsonAtomic } from "../../src/lib/node/fs";
import { recordSourceFailure } from "./diagnostics";
import { enrichAndFinalize } from "./enrichment";
import { assessRunHealth, isMaterialChange, renderRunSummary, summarizeError } from "./health";
import { HostThrottle, RobotsDisallowedError, createPoliteRequest, resolveRedirectTarget, robotsFetcherFor, withDeadline } from "./http";
import { MIN_HOST_INTERVAL_MS, ROBOTS_AGENT, SOURCE_DEADLINE_MS, USER_AGENT } from "./policy";
import { createRobotsGuard } from "./robots";
import { buildOpportunity } from "./opportunity-builder";
import { collectLaraJobsDrafts, finalizeLaraJobsDraft, laraJobsFeedUrl } from "./sources/larajobs";
import { collectLaravelNewsLinks, laravelNewsUrl } from "./sources/laravel-news";
import { collectRemotiveJobs, remotiveUrl } from "./sources/remotive";
import { collectWeWorkRemotely, weWorkRemotelyUrl } from "./sources/weworkremotely";

export { parseLaraJobsFeed } from "./sources/larajobs";

const outputPath = resolve("data/jobs.generated.json");
const diagnosticsDir = resolve(".jobs-diagnostics");
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

async function appendStepSummary(markdown: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await appendFile(summaryPath, `${markdown}\n`, "utf8");
}

/** Exposes results to later workflow steps without printing anything sensitive. */
async function setWorkflowOutputs(outputs: Record<string, string>) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  await appendFile(outputPath, Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", "utf8");
}

export async function collectJobs() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const discoveryPage = await context.newPage();
    const now = new Date().toISOString();
    const existing = await readExisting();

    const guard = createRobotsGuard(robotsFetcherFor(context.request), ROBOTS_AGENT);
    const throttle = new HostThrottle(MIN_HOST_INTERVAL_MS);
    const politeFor = (source: Opportunity["source"]) => createPoliteRequest({ request: context.request, guard, throttle, source });
    const resolveUrl = (url: string) => resolveRedirectTarget(url, { request: context.request, guard, throttle });

    const results: SourceCollectionOutcome[] = [];
    const durations: Partial<Record<Opportunity["source"], number>> = {};
    let laraJobsCanonicalUrls = new Set(
      (existing?.opportunities ?? []).filter((item) => item.source === "larajobs").map((item) => item.canonicalUrl)
    );

    /** Runs one source under its own deadline, so a failure or hang is contained, timed and reported. */
    async function runSource(source: Opportunity["source"], label: string, task: () => Promise<SourceCollectionSuccess>, page?: Page) {
      const startedAt = Date.now();
      try {
        results.push(await withDeadline(label, SOURCE_DEADLINE_MS, task));
      } catch (error) {
        const message = summarizeError(error);
        console.error(`${label} collection failed: ${message}`);
        await recordSourceFailure(source, error, page);
        results.push({ source, failed: true, error: message });
      } finally {
        durations[source] = Date.now() - startedAt;
      }
    }

    await runSource("larajobs", "LaraJobs", async () => {
      const drafts = await collectLaraJobsDrafts(politeFor("larajobs"));
      const opportunities = await enrichAndFinalize(
        context,
        drafts,
        (draft) => draft.canonicalUrl,
        (draft, finalizeNow, scrapedDescription, applicationUrl) => finalizeLaraJobsDraft(draft, finalizeNow, scrapedDescription, applicationUrl),
        { concurrency: ENRICHMENT_CONCURRENCY, resolveUrl },
        now
      );
      laraJobsCanonicalUrls = new Set([...laraJobsCanonicalUrls, ...opportunities.map((item) => item.canonicalUrl)]);
      return { source: "larajobs", opportunities, skipped: 0, rejected: 0 };
    });

    await runSource("laravel-news", "Laravel News", async () => {
      if (!(await guard.isAllowed(laravelNewsUrl))) throw new RobotsDisallowedError(laravelNewsUrl);
      await throttle.wait(new URL(laravelNewsUrl).host);
      const drafts = (await collectLaravelNewsLinks(discoveryPage))
        .filter((draft) => !laraJobsCanonicalUrls.has(draft.canonicalUrl))
        .slice(0, 20);
      // Title/company come from Laravel News's own listing; the scrape only supplies description text.
      const opportunities = await enrichAndFinalize(
        context,
        drafts,
        (draft) => draft.canonicalUrl,
        (draft, finalizeNow, scrapedDescription, applicationUrl) =>
          buildOpportunity(
            {
              title: draft.title,
              company: draft.company,
              url: draft.canonicalUrl,
              sourceUrl: laravelNewsUrl,
              description: scrapedDescription ?? undefined,
              applicationUrl,
              source: "laravel-news"
            },
            finalizeNow
          ),
        { concurrency: ENRICHMENT_CONCURRENCY, resolveUrl },
        now
      );
      return { source: "laravel-news", opportunities, skipped: 0, rejected: 0 };
    }, discoveryPage);

    await runSource("remotive", "Remotive", () => collectRemotiveJobs(politeFor("remotive"), now));
    await runSource("weworkremotely", "WeWorkRemotely", () => collectWeWorkRemotely(politeFor("weworkremotely"), now));

    const health = assessRunHealth(results);
    await mkdir(diagnosticsDir, { recursive: true });
    await writeFile(resolve(diagnosticsDir, "health.json"), JSON.stringify({ generatedAt: now, ...health, durationsMs: durations }, null, 2), "utf8");
    await setWorkflowOutputs({ degraded: String(health.degraded), all_failed: String(health.allFailed) });

    const { opportunities, stats } = mergeOpportunities(existing?.opportunities ?? [], results, now);

    const sources = results.map((result) => {
      const meta = sourceMeta[result.source];
      const stat = stats[result.source] ?? { added: 0, updated: 0, unchanged: 0, closed: 0, pruned: 0, held: 0 };
      const failed = "failed" in result;
      return {
        name: meta.name,
        url: meta.url,
        collectedAt: now,
        status: failed ? ("failed" as const) : ("ok" as const),
        durationMs: durations[result.source] ?? null,
        recordsFound: failed ? 0 : result.opportunities.length,
        added: stat.added,
        updated: stat.updated,
        closed: stat.closed,
        held: stat.held,
        skipped: failed ? 0 : result.skipped,
        rejected: failed ? 0 : result.rejected,
        error: failed ? result.error : null
      };
    });

    for (const [source, stat] of Object.entries(stats)) {
      if (stat.held > 0) console.warn(`${source}: returned no listings but ${stat.held} recently-seen listing(s) were held open instead of closed (possible broken filter/parser).`);
    }

    // Every source failing means there is nothing new to record: leave the last-known-good snapshot alone.
    if (health.allFailed) {
      await appendStepSummary(renderRunSummary({ sources, opportunities, health, written: false, reason: "every source failed" }));
      throw new Error(`All ${results.length} sources failed; refusing to publish a snapshot.`);
    }

    const previousOpenCount = (existing?.opportunities ?? []).filter((item) => item.status !== "closed").length;
    const nextOpenCount = opportunities.filter((item) => item.status !== "closed").length;
    if (previousOpenCount >= 20 && nextOpenCount < Math.ceil(previousOpenCount * 0.25)) {
      throw new Error(
        `Refusing to publish suspicious job snapshot: open opportunities collapsed from ${previousOpenCount} to ${nextOpenCount}`
      );
    }

    const change = isMaterialChange({ previous: existing, stats, nextSources: sources, now });
    if (!change.material) {
      await appendStepSummary(renderRunSummary({ sources, opportunities, health, written: false, reason: change.reason }));
      console.log(`Snapshot not rewritten: ${change.reason}.`);
    } else {
      const snapshot = opportunitySnapshotSchema.parse({
        schemaVersion: 2,
        generatedAt: now,
        collectorVersion: COLLECTOR_VERSION,
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
      await appendStepSummary(renderRunSummary({ sources: snapshot.sources, opportunities: snapshot.opportunities, health, written: true, reason: change.reason }));
      console.log(`Updated ${outputPath} with ${snapshot.opportunities.length} opportunities across ${sources.length} sources (${change.reason})`);
    }

    // A degraded run still publishes what succeeded; the workflow turns this into a visible red run after committing.
    if (health.degraded) console.warn(`Degraded run: ${health.failedSources.map((failure) => failure.source).join(", ")} failed.`);
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

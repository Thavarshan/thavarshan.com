import { COLLECTOR_VERSION, type OpportunitySnapshot, type SourceCollectionOutcome, type SourceStats } from "../../src/features/jobs/opportunities";

/** Even with nothing new, rewrite the snapshot at least this often so `lastSeenAt` (used by the empty-source grace guard) stays fresh. */
export const HEARTBEAT_HOURS = 48;

// eslint-disable-next-line no-control-regex
const ansiPattern = /\u001b\[[0-9;]*m/g;

/** One clean line for summaries and the committed snapshot: no ANSI colours, no request call logs, bounded length. */
export function summarizeError(error: unknown, maxLength = 240): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine =
    raw
      .replace(ansiPattern, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "unknown error";
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength - 1)}…` : firstLine;
}

export interface RunHealth {
  failedSources: Array<{ source: string; error: string }>;
  allFailed: boolean;
  degraded: boolean;
}

export function assessRunHealth(results: SourceCollectionOutcome[]): RunHealth {
  const failedSources = results.flatMap((result) => ("failed" in result ? [{ source: result.source, error: result.error }] : []));
  return { failedSources, allFailed: results.length > 0 && failedSources.length === results.length, degraded: failedSources.length > 0 };
}

/**
 * A run is worth committing only when something a reader could care about changed. Per-run
 * bookkeeping (`generatedAt`, per-source timings, `lastSeenAt` refreshes) does not count, which
 * keeps an unchanged day from producing a no-op commit.
 */
export function isMaterialChange(input: {
  previous: OpportunitySnapshot | null;
  stats: Record<string, SourceStats>;
  nextSources: OpportunitySnapshot["sources"];
  now: string;
}): { material: boolean; reason: string } {
  const { previous, stats, nextSources, now } = input;
  if (!previous) return { material: true, reason: "no previous snapshot" };
  if (previous.collectorVersion !== COLLECTOR_VERSION)
    return { material: true, reason: `collector version ${previous.collectorVersion ?? "none"} -> ${COLLECTOR_VERSION}` };

  for (const [source, stat] of Object.entries(stats)) {
    if (stat.added + stat.updated + stat.closed + stat.pruned + stat.held > 0) return { material: true, reason: `${source} changed` };
  }
  for (const next of nextSources) {
    const before = previous.sources.find((entry) => entry.name === next.name);
    if (!before || before.status !== next.status) return { material: true, reason: `${next.name} health changed` };
  }
  const ageHours = (new Date(now).getTime() - new Date(previous.generatedAt).getTime()) / 3_600_000;
  if (ageHours >= HEARTBEAT_HOURS) return { material: true, reason: `heartbeat (${Math.floor(ageHours)}h since last write)` };
  return { material: false, reason: "no material changes" };
}

function formatDuration(ms: number | null) {
  if (ms === null) return "n/a";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function renderRunSummary(input: {
  sources: OpportunitySnapshot["sources"];
  opportunities: OpportunitySnapshot["opportunities"];
  health: RunHealth;
  written: boolean;
  reason: string;
}): string {
  const { sources, opportunities, health, written, reason } = input;
  const headline = health.allFailed
    ? "### ❌ All sources failed — snapshot left untouched"
    : health.degraded
      ? `### ⚠️ Degraded — ${health.failedSources.length} of ${sources.length} sources failed (their previous data was carried forward)`
      : "### ✅ All sources healthy";
  const failures = health.failedSources.map((failure) => `- **${failure.source}**: ${failure.error}`);
  const rows = sources.map(
    (source) =>
      `| ${source.name} | ${source.status} | ${formatDuration(source.durationMs)} | ${source.recordsFound} | ${source.added} | ${source.updated} | ${source.closed} | ${source.held} | ${source.skipped} | ${source.rejected} |`
  );
  const top = opportunities
    .filter((item) => item.status !== "closed")
    .slice(0, 5)
    .map((item) => `- **${item.score}** ${item.title} @ ${item.company ?? "Unknown"} (${item.eligibility})`);

  return [
    "## Laravel jobs refresh",
    "",
    headline,
    ...(failures.length ? ["", ...failures] : []),
    "",
    `Snapshot: ${written ? `written (${reason})` : `not rewritten (${reason})`}`,
    "",
    "| Source | Status | Duration | Records | Added | Updated | Closed | Held | Skipped | Rejected |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "### Top 5 by score",
    ...(top.length > 0 ? top : ["_None_"]),
    ""
  ].join("\n");
}

import { z } from "zod";
import { eventNames, stageOf, type EventName, type ReferrerClass } from "./events";

/**
 * Weekly aggregate snapshots (issue #47): deterministic, comparable over time, and explicit about what
 * is measured versus unknown. Pure functions; the CLI feeds them rows read from the collector's KV.
 */

export const SNAPSHOT_VERSION = 1;

export interface AggregateRow {
  day: string;
  event: EventName;
  path: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: ReferrerClass;
  props: Record<string, string>;
  count: number;
}

export interface Period {
  start: string;
  end: string;
  isoWeek: string;
}

const counts = z.record(z.string(), z.number().int().nonnegative());

export const snapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_VERSION),
  generatedAt: z.string().datetime(),
  period: z.object({ start: z.string(), end: z.string(), isoWeek: z.string() }),
  coverage: z.object({
    rows: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    daysWithData: z.number().int().nonnegative(),
    daysInPeriod: z.number().int().positive()
  }),
  totals: z.object({ byStage: counts, byEvent: counts }),
  acquisition: z.object({
    byReferrer: counts,
    byCampaign: z.array(z.object({ source: z.string(), medium: z.string(), campaign: z.string(), events: z.number().int(), intentEvents: z.number().int() })),
    attributed: z.number().int().nonnegative(),
    unattributed: z.number().int().nonnegative(),
    unattributedShare: z.number().min(0).max(1)
  }),
  intent: z.object({ byProject: z.record(z.string(), counts), byTool: z.record(z.string(), counts), byLocation: counts }),
  content: z.object({
    topPaths: z.array(z.object({ path: z.string(), events: z.number().int(), intentEvents: z.number().int() })),
    insightsRead: z.array(z.object({ slug: z.string(), reads: z.number().int() }))
  }),
  comparison: z.object({
    previousIsoWeek: z.string().nullable(),
    byEvent: z.record(z.string(), z.object({ previous: z.number().int(), current: z.number().int(), delta: z.number().int() }))
  }),
  notes: z.array(z.string())
});

export type MetricsSnapshot = z.infer<typeof snapshotSchema>;

function bump(target: Record<string, number>, key: string, by: number) {
  target[key] = (target[key] ?? 0) + by;
}

/** ISO week (Monday-Sunday, UTC) that ended before `now`, e.g. for a Monday run, the week that just finished. */
export function lastCompletedWeek(now: Date): Period {
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = (utc.getUTCDay() + 6) % 7; // Monday = 0
  const thisMonday = new Date(utc.getTime() - dayOfWeek * 86_400_000);
  const start = new Date(thisMonday.getTime() - 7 * 86_400_000);
  const end = new Date(thisMonday.getTime() - 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), isoWeek: isoWeekLabel(start) };
}

export function isoWeekLabel(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Thursday of this week decides the ISO year
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let time = Date.parse(start); time <= Date.parse(end); time += 86_400_000) days.push(new Date(time).toISOString().slice(0, 10));
  return days;
}

export function buildSnapshot(rows: AggregateRow[], period: Period, generatedAt: string, previous: MetricsSnapshot | null): MetricsSnapshot {
  const inPeriod = rows.filter((row) => row.day >= period.start && row.day <= period.end);
  const byStage: Record<string, number> = { engagement: 0, intent: 0 };
  const byEvent: Record<string, number> = Object.fromEntries(eventNames.map((name) => [name, 0]));
  const byReferrer: Record<string, number> = {};
  const campaigns = new Map<string, { source: string; medium: string; campaign: string; events: number; intentEvents: number }>();
  const byProject: Record<string, Record<string, number>> = {};
  const byTool: Record<string, Record<string, number>> = {};
  const byLocation: Record<string, number> = {};
  const paths = new Map<string, { path: string; events: number; intentEvents: number }>();
  const reads = new Map<string, number>();
  let attributed = 0;
  let unattributed = 0;
  let total = 0;

  for (const row of inPeriod) {
    const intent = stageOf(row.event) === "intent";
    total += row.count;
    bump(byStage, stageOf(row.event), row.count);
    bump(byEvent, row.event, row.count);
    bump(byReferrer, row.referrer, row.count);

    // "Attributed" means we know a campaign (UTM) or a specific non-direct referrer class. Everything else is
    // reported as unattributed rather than guessed.
    if (row.campaign || row.source || !["direct", "internal"].includes(row.referrer)) attributed += row.count;
    else unattributed += row.count;

    if (row.source && row.medium && row.campaign) {
      const key = `${row.source}|${row.medium}|${row.campaign}`;
      const entry = campaigns.get(key) ?? { source: row.source, medium: row.medium, campaign: row.campaign, events: 0, intentEvents: 0 };
      entry.events += row.count;
      if (intent) entry.intentEvents += row.count;
      campaigns.set(key, entry);
    }

    const project = row.props.project;
    if (project) bump((byProject[project] ??= {}), row.event, row.count);
    const tool = row.props.tool;
    if (tool) bump((byTool[tool] ??= {}), row.event, row.count);
    if (row.props.location && intent) bump(byLocation, row.props.location, row.count);

    const pathEntry = paths.get(row.path) ?? { path: row.path, events: 0, intentEvents: 0 };
    pathEntry.events += row.count;
    if (intent) pathEntry.intentEvents += row.count;
    paths.set(row.path, pathEntry);

    if (row.event === "insight_read" && row.props.slug) reads.set(row.props.slug, (reads.get(row.props.slug) ?? 0) + row.count);
  }

  const daysInPeriod = daysBetween(period.start, period.end).length;
  const daysWithData = new Set(inPeriod.map((row) => row.day)).size;
  const unattributedShare = total === 0 ? 0 : Math.round((unattributed / total) * 1000) / 1000;

  const comparison: MetricsSnapshot["comparison"] = { previousIsoWeek: previous?.period.isoWeek ?? null, byEvent: {} };
  for (const name of eventNames) {
    const current = byEvent[name] ?? 0;
    const before = previous?.totals.byEvent[name] ?? 0;
    if (previous || current > 0) comparison.byEvent[name] = { previous: before, current, delta: current - before };
  }

  const notes = [
    "Counts are actions by visitors whose browsers allowed the beacon. Visitors using Do Not Track / Global Privacy Control, blockers, or no JavaScript are not counted, so treat every number as a lower bound.",
    "Page views are deliberately not collected, so conversion RATES cannot be computed. These are counts of actions, not percentages of visitors.",
    `${Math.round(unattributedShare * 100)}% of counted actions have no campaign or referrer signal (direct visits, copied links, or stripped referrers). That share is unknown attribution and is reported as such, not assigned to a channel.`,
    `The collector accepts unauthenticated events from the site's origin, so counts are indicative rather than audited.`
  ];
  if (daysWithData < daysInPeriod)
    notes.push(`Only ${daysWithData} of ${daysInPeriod} days in this period recorded any events; quiet days and collection gaps look the same.`);
  if (total === 0) notes.push("No events were recorded in this period.");

  return {
    schemaVersion: SNAPSHOT_VERSION,
    generatedAt,
    period,
    coverage: { rows: inPeriod.length, events: total, daysWithData, daysInPeriod },
    totals: { byStage, byEvent },
    acquisition: {
      byReferrer,
      byCampaign: [...campaigns.values()].sort((a, b) => b.intentEvents - a.intentEvents || b.events - a.events || a.campaign.localeCompare(b.campaign)),
      attributed,
      unattributed,
      unattributedShare
    },
    intent: { byProject, byTool, byLocation },
    content: {
      topPaths: [...paths.values()].sort((a, b) => b.intentEvents - a.intentEvents || b.events - a.events || a.path.localeCompare(b.path)).slice(0, 10),
      insightsRead: [...reads.entries()].map(([slug, count]) => ({ slug, reads: count })).sort((a, b) => b.reads - a.reads || a.slug.localeCompare(b.slug))
    },
    comparison,
    notes
  };
}

export function renderSnapshotSummary(snapshot: MetricsSnapshot): string {
  const lines = [`## Growth metrics ${snapshot.period.isoWeek} (${snapshot.period.start} to ${snapshot.period.end})`, ""];
  lines.push(
    `**${snapshot.totals.byStage.intent ?? 0} intent actions**, ${snapshot.totals.byStage.engagement ?? 0} engagement actions. Days with data: ${snapshot.coverage.daysWithData}/${snapshot.coverage.daysInPeriod}.`,
    ""
  );
  lines.push("| Event | Stage | This week | Previous | Change |", "| --- | --- | ---: | ---: | ---: |");
  for (const name of eventNames) {
    const entry = snapshot.comparison.byEvent[name];
    const current = snapshot.totals.byEvent[name] ?? 0;
    if (!entry && current === 0) continue;
    lines.push(`| \`${name}\` | ${stageOf(name)} | ${current} | ${entry?.previous ?? 0} | ${entry ? (entry.delta > 0 ? "+" : "") + entry.delta : "0"} |`);
  }
  lines.push("", "### Where actions came from", "");
  for (const [referrer, count] of Object.entries(snapshot.acquisition.byReferrer).sort((a, b) => b[1] - a[1])) lines.push(`- ${referrer}: ${count}`);
  lines.push(`- **unattributed: ${snapshot.acquisition.unattributed} (${Math.round(snapshot.acquisition.unattributedShare * 100)}%)**`, "");
  if (snapshot.acquisition.byCampaign.length > 0) {
    lines.push("### Campaigns (UTM)", "", "| Source / medium / campaign | Actions | Intent |", "| --- | ---: | ---: |");
    for (const campaign of snapshot.acquisition.byCampaign.slice(0, 10))
      lines.push(`| ${campaign.source} / ${campaign.medium} / ${campaign.campaign} | ${campaign.events} | ${campaign.intentEvents} |`);
    lines.push("");
  }
  lines.push("### Read this carefully", "", ...snapshot.notes.map((note) => `- ${note}`), "");
  return lines.join("\n");
}

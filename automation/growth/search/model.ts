import { z } from "zod";

export const origin = "https://thavarshan.com";
export const searchPolicy = { maxRows: 1000, maxBytes: 2 * 1024 * 1024, maxAgeDays: 10, minImpressions: 100, lowCtr: 0.02, maxOpportunities: 20 };
export const dateSchema = z
  .string()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const dateMs = (value: string) => Date.parse(`${value}T00:00:00Z`);
const metrics = z
  .object({
    clicks: z.number().int().nonnegative().max(1e9),
    impressions: z.number().int().nonnegative().max(1e12),
    position: z.number().min(1).max(1e6).nullable()
  })
  .strict()
  .refine((row) => row.clicks <= row.impressions && (row.impressions === 0 ? row.position === null : row.position !== null));
export const metricsSchema = metrics;
export const pageUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === origin &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password &&
        /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(url.pathname) &&
        value === `${origin}${url.pathname}`
      );
    } catch {
      return false;
    }
  });
const query = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127));
const period = z
  .object({
    start: dateSchema,
    end: dateSchema,
    totals: metrics.nullable(),
    pages: z.array(z.object({ page: pageUrl, metrics }).strict()).max(searchPolicy.maxRows),
    queries: z.array(z.object({ page: pageUrl, query, metrics }).strict()).max(searchPolicy.maxRows)
  })
  .strict()
  .refine(
    (value) =>
      dateMs(value.end) - dateMs(value.start) === 27 * 86400000 &&
      new Set(value.pages.map((row) => row.page)).size === value.pages.length &&
      new Set(value.queries.map((row) => JSON.stringify([row.page, row.query.toLowerCase()]))).size === value.queries.length
  );
export const searchSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.enum(["google", "bing"]),
    property: z.enum([`${origin}/`, "sc-domain:thavarshan.com"]),
    collectedAt: z.string().datetime(),
    searchType: z.literal("web"),
    filters: z.object({ country: z.literal("all"), device: z.literal("all") }).strict(),
    timezone: z.enum(["America/Los_Angeles", "UTC"]),
    coverage: z.literal("partial-top-rows"),
    current: period,
    previous: period
  })
  .strict()
  .refine(
    (value) =>
      dateMs(value.current.start) - dateMs(value.previous.end) === 86400000 &&
      dateMs(value.current.end) <= Date.parse(value.collectedAt) &&
      (value.source !== "google" || value.timezone === "America/Los_Angeles")
  );
export type SearchSnapshot = z.infer<typeof searchSnapshotSchema>;
export const indexingSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.enum(["google", "bing"]),
    observations: z
      .array(z.object({ date: dateSchema, indexedPages: z.number().int().nonnegative().max(1e7) }).strict())
      .min(1)
      .max(32)
  })
  .strict()
  .refine((value) => new Set(value.observations.map((row) => row.date)).size === value.observations.length);
export const publicSearchStatusSchema = z
  .object({ schemaVersion: z.literal(1), status: z.enum(["available", "no-data", "stale", "unavailable", "failed"]) })
  .strict();
export type PublicSearchStatus = z.infer<typeof publicSearchStatusSchema>;
const ctr = (value: z.infer<typeof metrics> | null) => (value && value.impressions ? value.clicks / value.impressions : null);
const branded = (value: string) => /\b(?:thavarshan|jerome)\b/i.test(value);
const escaped = (value: string) => [...value].map((character) => ("\\`*_{}[]()<>|#!".includes(character) ? `\\${character}` : character)).join("");

/** Private deterministic evidence; thresholds are review heuristics, never ranking promises. */
export function analyzeSearch(raw: unknown, knownPaths: Set<string>, now = new Date(), rawIndexing?: unknown) {
  const data = searchSnapshotSchema.parse(raw);
  if (!Number.isFinite(now.getTime()) || Date.parse(data.collectedAt) > now.getTime() + 300000) throw new Error("Invalid collection time");
  const stale = now.getTime() - dateMs(data.current.end) > searchPolicy.maxAgeDays * 86400000;
  const priorPages = new Map(data.previous.pages.map((row) => [row.page, row.metrics]));
  const priorQueries = new Set(data.previous.queries.map((row) => JSON.stringify([row.page, row.query.toLowerCase()])));
  type Opportunity = {
    rule: string;
    page: string;
    query: string | null;
    branded: boolean | null;
    score: number;
    observation: string;
    recommendation: string;
    action: "snippet-review" | "refresh-and-link" | "intent-review" | "technical-review";
    evidence: { current: z.infer<typeof metrics>; previous: z.infer<typeof metrics> | null; ctr: number | null };
  };
  const opportunities: Opportunity[] = [];
  const add = (
    row: { page: string; query?: string; metrics: z.infer<typeof metrics> },
    rule: string,
    score: number,
    observation: string,
    recommendation: string,
    action: Opportunity["action"],
    previous: z.infer<typeof metrics> | null = null
  ) => {
    const known = knownPaths.has(new URL(row.page).pathname);
    opportunities.push({
      rule,
      page: row.page,
      query: row.query ?? null,
      branded: row.query ? branded(row.query) : null,
      score,
      observation,
      recommendation: known ? recommendation : "Inspect canonical/redirect ownership for this unrecognized URL before planning content.",
      action: known ? action : "technical-review",
      evidence: { current: row.metrics, previous, ctr: ctr(row.metrics) }
    });
  };
  if (!stale) {
    for (const row of data.current.pages) {
      const previous = priorPages.get(row.page);
      if (row.metrics.impressions >= searchPolicy.minImpressions && ctr(row.metrics)! < searchPolicy.lowCtr && row.metrics.position! <= 20)
        add(
          row,
          "low-ctr",
          70,
          "At least 100 impressions, CTR below 2%, and average position at most 20.",
          "Review title/snippet against demonstrated search intent; treat 2% as a heuristic, not a universal benchmark.",
          "snippet-review"
        );
      if (
        previous &&
        previous.clicks >= 10 &&
        previous.impressions >= 100 &&
        previous.clicks - row.metrics.clicks >= 5 &&
        row.metrics.clicks <= previous.clicks * 0.8
      )
        add(
          row,
          "declining-clicks",
          90,
          "Matched page clicks fell by at least 20% and five clicks between equal periods.",
          "Check indexing, seasonality and content changes before refreshing useful evidence and internal links.",
          "refresh-and-link",
          previous
        );
    }
    for (const row of data.current.queries) {
      if (row.metrics.impressions >= 50 && row.metrics.position! >= 8 && row.metrics.position! <= 20)
        add(
          row,
          "position-8-20",
          branded(row.query) ? 50 : 60,
          "Observed page/query has at least 50 impressions and average position between 8 and 20.",
          "Review whether the existing page answers this intent; improve useful coverage and contextual internal links.",
          "refresh-and-link"
        );
      if (row.metrics.impressions >= 50 && !priorQueries.has(JSON.stringify([row.page, row.query.toLowerCase()])))
        add(
          row,
          "newly-observed-query",
          40,
          "Page/query appears in this period's top rows but not the previous export; previous traffic is unknown.",
          "Validate the intent against project evidence; improve the existing page first. Propose new content only for a distinct unmet intent.",
          "intent-review"
        );
    }
  }
  opportunities.sort(
    (a, b) => b.score - a.score || a.page.localeCompare(b.page) || (a.query ?? "").localeCompare(b.query ?? "") || a.rule.localeCompare(b.rule)
  );
  let indexing: { source: string; latest: { date: string; indexedPages: number }; delta: number | null } | null = null;
  if (rawIndexing !== undefined) {
    const input = indexingSchema.parse(rawIndexing);
    if (input.source !== data.source || input.observations.some((row) => dateMs(row.date) > now.getTime())) throw new Error("Invalid indexing observation");
    const sorted = [...input.observations].sort((a, b) => a.date.localeCompare(b.date));
    indexing = { source: input.source, latest: sorted.at(-1)!, delta: sorted.length > 1 ? sorted.at(-1)!.indexedPages - sorted.at(-2)!.indexedPages : null };
  }
  const report = {
    schemaVersion: 1,
    source: data.source,
    collectedAt: data.collectedAt,
    property: data.property,
    searchType: data.searchType,
    timezone: data.timezone,
    status: stale ? "stale" : data.current.totals === null ? "no-data" : "available",
    periods: {
      current: {
        start: data.current.start,
        end: data.current.end,
        clicks: null,
        impressions: null,
        position: null,
        ...data.current.totals,
        ctr: ctr(data.current.totals)
      },
      previous: {
        start: data.previous.start,
        end: data.previous.end,
        clicks: null,
        impressions: null,
        position: null,
        ...data.previous.totals,
        ctr: ctr(data.previous.totals)
      }
    },
    clickDelta: data.current.totals && data.previous.totals ? data.current.totals.clicks - data.previous.totals.clicks : null,
    indexing,
    queryCoverage: {
      brandedRows: data.current.queries.filter((row) => branded(row.query)).length,
      nonBrandedRows: data.current.queries.filter((row) => !branded(row.query)).length
    },
    opportunities: opportunities.slice(0, searchPolicy.maxOpportunities),
    notes: [
      "Google and Bing are analyzed separately; property totals are never summed from page/query rows.",
      "Top rows are incomplete and anonymized queries may be omitted. Missing rows do not mean zero traffic.",
      "No visitors, enquiries or causal SEO effects can be inferred from these metrics.",
      "Recommendations are deterministic human-review tasks; never automatic public content edits."
    ]
  };
  const plan = {
    schemaVersion: 1,
    source: data.source,
    period: { start: data.current.start, end: data.current.end },
    requiresHumanReview: true,
    tasks: report.opportunities.map((item, index) => ({
      priority: index + 1,
      page: item.page,
      query: item.query,
      action: item.action,
      rule: item.rule,
      evidence: item.evidence,
      recommendation: item.recommendation
    }))
  };
  const summary = `# Private search feedback: ${report.status}\n\nSource: ${data.source}; ${data.current.start}–${data.current.end} versus ${data.previous.start}–${data.previous.end} (${data.timezone}, web).\n\nCurrent property metrics: ${data.current.totals ? `${data.current.totals.clicks} clicks; ${data.current.totals.impressions} impressions; CTR ${ctr(data.current.totals) === null ? "undefined" : (ctr(data.current.totals)! * 100).toFixed(2) + "%"}; position ${data.current.totals.position ?? "unknown"}` : "no observed aggregate row; metrics unknown"}.\n\nIndexed pages: ${indexing ? `${indexing.latest.indexedPages} on ${indexing.latest.date}; change ${indexing.delta ?? "unknown"}` : "unknown; no owner-supplied Page Indexing observations"}.\n\n## Prioritized review tasks\n\n${report.opportunities.map((item) => `- **${item.rule}** ${escaped(item.page)}${item.query ? ` — ${escaped(item.query)} (${item.branded ? "branded" : "non-branded"})` : ""}\n  Observation: ${item.observation}\n  Recommendation: ${item.recommendation}`).join("\n") || "No actionable tasks under the stated data/threshold policy."}\n\n${report.notes.map((note) => `- ${note}`).join("\n")}\n`;
  return { report, plan, summary };
}

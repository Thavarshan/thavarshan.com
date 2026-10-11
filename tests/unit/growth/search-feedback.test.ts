// @vitest-environment node
import { describe, expect, it } from "vitest";
import { analyzeSearch, dateSchema, searchSnapshotSchema, type SearchSnapshot } from "../../../automation/growth/search/model";
import { buildHealthReport, renderHealthSummary } from "../../../automation/growth/health/report";

export const now = new Date("2026-10-11T12:00:00Z");
const url = "https://thavarshan.com/tools/laravel-env-checker";
export const known = new Set(["/", "/tools/laravel-env-checker"]);
export const snapshot = (): SearchSnapshot => ({
  schemaVersion: 1,
  source: "google",
  property: "https://thavarshan.com/",
  collectedAt: now.toISOString(),
  searchType: "web",
  filters: { country: "all", device: "all" },
  timezone: "America/Los_Angeles",
  coverage: "partial-top-rows",
  current: {
    start: "2026-09-11",
    end: "2026-10-08",
    totals: { clicks: 20, impressions: 1000, position: 10 },
    pages: [{ page: url, metrics: { clicks: 2, impressions: 200, position: 12 } }],
    queries: [{ page: url, query: "laravel env checker", metrics: { clicks: 1, impressions: 100, position: 12 } }]
  },
  previous: {
    start: "2026-08-14",
    end: "2026-09-10",
    totals: { clicks: 30, impressions: 1500, position: 9 },
    pages: [{ page: url, metrics: { clicks: 20, impressions: 250, position: 10 } }],
    queries: []
  }
});

describe("private search evidence and priority rules", () => {
  it("uses independent property totals, computes CTR and ranks matched decline first", () => {
    const result = analyzeSearch(snapshot(), known, now);
    expect(result.report.periods.current.clicks).toBe(20);
    expect(result.report.periods.current.ctr).toBe(0.02);
    expect(result.report.clickDelta).toBe(-10);
    expect(result.report.opportunities.map((item) => item.rule)).toEqual(["declining-clicks", "low-ctr", "position-8-20", "newly-observed-query"]);
    expect(result.plan.requiresHumanReview).toBe(true);
    expect(result.plan.tasks[0].evidence.previous?.clicks).toBe(20);
    expect(result.summary).toContain("previous traffic is unknown");
  });
  it("keeps new-query absence unknown and distinguishes brand rows", () => {
    const input = snapshot();
    input.current.queries.push({ ...input.current.queries[0], query: "Jerome Thavarshan tools" });
    const result = analyzeSearch(input, known, now);
    expect(result.report.queryCoverage).toEqual({ brandedRows: 1, nonBrandedRows: 1 });
    expect(result.report.opportunities.find((item) => item.query?.startsWith("Jerome"))?.branded).toBe(true);
    expect(result.report.opportunities.find((item) => item.rule === "newly-observed-query")?.evidence.previous).toBeNull();
  });
  it("does not infer a decline from an absent prior page", () => {
    const input = snapshot();
    input.previous.pages = [];
    expect(analyzeSearch(input, known, now).report.opportunities.some((item) => item.rule === "declining-clicks")).toBe(false);
  });
  it("avoids low-volume CTR tasks and respects the explicit position boundaries", () => {
    const input = snapshot();
    input.current.pages[0].metrics = { clicks: 1, impressions: 99, position: 12 };
    expect(analyzeSearch(input, known, now).report.opportunities.some((item) => item.rule === "low-ctr")).toBe(false);
    for (const position of [7.9, 8, 20, 20.1]) {
      input.current.queries[0].metrics = { clicks: 1, impressions: 50, position };
      expect(analyzeSearch(input, known, now).report.opportunities.some((item) => item.rule === "position-8-20")).toBe(position >= 8 && position <= 20);
    }
  });
  it("represents missing totals and zero denominators without invented CTR/position", () => {
    const input = snapshot();
    input.current = { ...input.current, totals: null, pages: [], queries: [] };
    input.previous.totals = { clicks: 0, impressions: 0, position: null };
    const report = analyzeSearch(input, known, now).report;
    expect(report.status).toBe("no-data");
    expect(report.clickDelta).toBeNull();
    expect(report.periods.previous.ctr).toBeNull();
    expect(report.periods.current.ctr).toBeNull();
  });
  it("suppresses stale suggestions and labels unknown canonical pages for technical review", () => {
    expect(analyzeSearch(snapshot(), known, new Date("2026-11-01T00:00:00Z")).report.opportunities).toEqual([]);
    expect(analyzeSearch(snapshot(), new Set(), now).plan.tasks.every((task) => task.action === "technical-review")).toBe(true);
  });
  it("tracks dated indexing observations separately from sitemap counts", () => {
    const result = analyzeSearch(snapshot(), known, now, {
      schemaVersion: 1,
      source: "google",
      observations: [
        { date: "2026-10-01", indexedPages: 10 },
        { date: "2026-10-09", indexedPages: 12 }
      ]
    });
    expect(result.report.indexing?.delta).toBe(2);
    expect(analyzeSearch(snapshot(), known, now).report.indexing).toBeNull();
    expect(() =>
      analyzeSearch(snapshot(), known, now, { schemaVersion: 1, source: "bing", observations: [{ date: "2026-10-09", indexedPages: 12 }] })
    ).toThrow();
  });
  it.each(["2026-02-30", "invalid", "2026-01-32"])("rejects impossible date %s without throwing from schema callbacks", (date) => {
    expect(dateSchema.safeParse(date).success).toBe(false);
  });
  it("rejects mixed filters, unknown fields, duplicates and unequal/noncontiguous periods", () => {
    for (const mutate of [
      (input: SearchSnapshot) => {
        input.current.pages.push(input.current.pages[0]);
      },
      (input: SearchSnapshot) => {
        input.current.end = "2026-10-07";
      },
      (input: SearchSnapshot) => {
        input.previous.start = "2026-08-13";
        input.previous.end = "2026-09-09";
      },
      (input: SearchSnapshot) => {
        input.current.pages[0].page = "https://example.com/private";
      },
      (input: SearchSnapshot) => {
        input.current.pages[0].metrics.clicks = 99999;
      }
    ]) {
      const input = snapshot();
      mutate(input);
      expect(searchSnapshotSchema.safeParse(input).success).toBe(false);
    }
    expect(searchSnapshotSchema.safeParse({ ...snapshot(), userId: "PERSON" }).success).toBe(false);
    expect(() => analyzeSearch({ ...snapshot(), collectedAt: "2027-01-01T00:00:00Z" }, known, now)).toThrow();
  });
  it("does not mix Bing and Google, and bounds output deterministically", () => {
    const input = snapshot();
    input.source = "bing";
    input.timezone = "UTC";
    input.current.queries = Array.from({ length: 30 }, (_, index) => ({ ...input.current.queries[0], query: `laravel task ${index}` }));
    const result = analyzeSearch(input, known, now);
    expect(result.report.source).toBe("bing");
    expect(result.plan.tasks).toHaveLength(20);
    const shuffled = { ...input, current: { ...input.current, queries: [...input.current.queries].reverse() } };
    expect(analyzeSearch(shuffled, known, now).plan).toEqual(result.plan);
  });
  it("only projects validated availability into the public health report", () => {
    const base = {
      now,
      workflowRuns: {},
      applicationGeneration: "unknown" as const,
      jobs: undefined,
      github: undefined,
      marketing: undefined,
      registry: undefined,
      metrics: undefined,
      baseline: null,
      deployment: { status: "unavailable" as const, revision: null },
      metricsWorker: "unavailable" as const
    };
    const result = buildHealthReport({ ...base, searchStatus: { schemaVersion: 1, status: "available" } });
    expect(result.report.search.performance).toBe("available");
    expect(renderHealthSummary(result.report)).toContain("prioritized content tasks remain in the private repository");
    const unsafe = buildHealthReport({ ...base, searchStatus: { schemaVersion: 1, status: "available", query: "PRIVATE_QUERY" } });
    expect(unsafe.report.search.performance).toBe("unavailable");
    expect(JSON.stringify(unsafe.report)).not.toContain("PRIVATE_QUERY");
    expect(
      buildHealthReport({ ...base, searchStatus: { schemaVersion: 1, status: "failed" } }).report.findings.some((finding) => finding.code === "feedback-failed")
    ).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  ageHours,
  baselineSchema,
  buildHealthReport,
  policy,
  renderHealthSummary,
  workflows,
  type ReportInput
} from "../../../automation/growth/health/report";
import { collectPublicHealth, readPublicJson } from "../../../automation/growth/health/collect";

const fixture = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const now = new Date("2026-10-09T12:00:00.000Z");
const run = (id = 1, conclusion = "success", at = "2026-10-09T05:00:00.000Z") => ({
  id,
  status: "completed",
  conclusion,
  created_at: at,
  updated_at: at,
  privateNote: "PRIVATE_SENTINEL"
});
const input = (): ReportInput => ({
  now,
  workflowRuns: Object.fromEntries(workflows.map((workflow) => [workflow.file, [run()]])),
  applicationGeneration: "ran",
  jobs: fixture("tests/fixtures/jobs/health-v2.json"),
  github: { ...fixture("data/github.generated.json"), syncedAt: "2026-10-09T05:00:00.000Z" },
  marketing: { ...fixture("marketing/oss-ledger.json"), lastGeneratedAt: {} },
  registry: { ...fixture("data/package-registry.generated.json"), syncedAt: "2026-10-09T05:00:00.000Z" },
  metrics: fixture("data/growth/latest.json"),
  baseline: null,
  deployment: { status: "ok", revision: "a".repeat(40) },
  metricsWorker: "ok"
});

// Frozen public jobs fixture preserves scoring/eligibility cases across scheduled snapshot refreshes.
describe("Growth Engine health rules", () => {
  it("reports real eligibility conservatively with unknown initial deltas", () => {
    const { report, nextBaseline } = buildHealthReport(input());
    expect(report.jobs).not.toBeNull();
    expect(report.jobs!.eligible).toBeLessThanOrEqual(report.jobs!.active);
    expect(report.jobs!.newEligibleHighFitIds).toBeNull();
    expect(nextBaseline).not.toBeNull();
    expect(baselineSchema.safeParse(nextBaseline).success).toBe(true);
    expect(report.applications.preparedCount).toBeNull();
    expect(report.search.indexing).toBe("unknown");
  });
  it("compares known jobs and eligible sets independently", () => {
    const previous = buildHealthReport(input()).nextBaseline!;
    const state = { ...previous, generatedAt: "2026-10-02T12:00:00.000Z", eligibleHighFitIds: [] };
    const { report } = buildHealthReport({ ...input(), baseline: state });
    expect(report.jobs!.newlyDiscoveredHighFitIds).toEqual([]);
    expect(report.jobs!.newEligibleHighFitIds).toEqual(report.jobs!.eligibleHighFitIds);
    expect(report.comparison.since).toBe(state.generatedAt);
  });
  it("does not replace a malformed or future comparison baseline", () => {
    for (const baseline of [{ schemaVersion: 99 }, { ...buildHealthReport(input()).nextBaseline!, generatedAt: "2027-01-01T00:00:00.000Z" }]) {
      const result = buildHealthReport({ ...input(), baseline });
      expect(result.nextBaseline).toBeNull();
      expect(result.report.jobs!.newEligibleHighFitIds).toBeNull();
      expect(result.report.findings.some((finding) => finding.code === "baseline-invalid")).toBe(true);
    }
  });
  it("keeps a report when independent subsystems are unavailable, without zero-filling", () => {
    const { report, nextBaseline } = buildHealthReport({
      ...input(),
      jobs: undefined,
      metrics: undefined,
      marketing: undefined,
      github: undefined,
      registry: undefined,
      workflowRuns: {}
    });
    expect(report.status).toBe("attention");
    expect(report.jobs).toBeNull();
    expect(report.analytics).toBeNull();
    expect(report.marketing.generatedBundles).toBeNull();
    expect(nextBaseline).toBeNull();
    expect(renderHealthSummary(report)).toContain("high-fit: unknown");
  });
  it("distinguishes latest failure/running state from last successful workflow", () => {
    const i = input();
    i.workflowRuns["jobs-refresh.yml"] = [run(2, "failure"), run(1, "success", "2026-10-08T05:00:00.000Z")];
    i.workflowRuns["content-refresh.yml"] = [{ ...run(3), status: "in_progress", conclusion: null }];
    const { report } = buildHealthReport(i);
    expect(report.workflows.find((workflow) => workflow.file === "jobs-refresh.yml")!.lastSuccessfulRun!.id).toBe(1);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["workflow-failed", "workflow-running"]));
  });
  it("does not treat missing/skipped workflow runs as successful generation", () => {
    const i = input();
    i.workflowRuns["jobs-refresh.yml"] = [run(2, "skipped")];
    i.applicationGeneration = "skipped";
    const { report } = buildHealthReport(i);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["workflow-missing", "generation-skipped"]));
    expect(report.applications.appliedCount).toBeNull();
  });
  it("preserves the comparison baseline for stale jobs or failed/held sources", () => {
    for (const kind of ["stale", "failed", "held", "future"]) {
      const i = input();
      const jobs = i.jobs as { generatedAt: string; sources: Array<{ status: string; held: number }> };
      if (kind === "stale") jobs.generatedAt = "2026-10-01T00:00:00.000Z";
      if (kind === "future") jobs.generatedAt = "2027-01-01T00:00:00.000Z";
      if (kind === "failed") jobs.sources[0].status = "failed";
      if (kind === "held") jobs.sources[0].held = 1;
      expect(buildHealthReport(i).nextBaseline).toBeNull();
    }
  });
  it("flags scoring drift and excludes disputed eligibility", () => {
    const i = input();
    const jobs = i.jobs as { opportunities: Array<{ id: string; status: string; eligibility: string; score: number }> };
    const job = jobs.opportunities.find((job) => job.status !== "closed" && job.eligibility === "ineligible")!;
    job.eligibility = "eligible";
    job.score = 100;
    const { report, nextBaseline } = buildHealthReport(i);
    expect(report.jobs!.scoringMismatches).toBeGreaterThan(0);
    expect(nextBaseline).toBeNull();
    expect(report.jobs!.eligibleHighFitIds).not.toContain(job.id);
    expect(report.findings.some((finding) => finding.code === "scoring-drift")).toBe(true);
  });
  it("handles genuine zero opportunities without inventing missing data", () => {
    const i = input();
    (i.jobs as { opportunities: unknown[] }).opportunities = [];
    const { report } = buildHealthReport(i);
    expect(report.jobs!.active).toBe(0);
    expect(report.jobs!.highFit).toBe(0);
  });
  it("does not publish untrusted descriptions, source errors, campaign strings or private state", () => {
    const i = input();
    const jobs = i.jobs as { opportunities: Array<{ title: string; descriptionText: string }>; sources: Array<{ error: string }> };
    for (const job of jobs.opportunities) {
      job.title += " PRIVATE_SENTINEL";
      job.descriptionText += " PRIVATE_SENTINEL";
    }
    jobs.sources[0].error = "PRIVATE_SENTINEL";
    (i.metrics as { notes: string[] }).notes.push("PRIVATE_SENTINEL");
    const { report, nextBaseline } = buildHealthReport(i);
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
    expect(renderHealthSummary(report)).not.toContain("PRIVATE_SENTINEL");
    expect(JSON.stringify(nextBaseline)).not.toContain("PRIVATE_SENTINEL");
  });
  it("applies explicit staleness/future tolerances", () => {
    expect(ageHours("bad", now)).toBeNull();
    expect(ageHours("2027-01-01", now)).toBeNull();
    expect(ageHours("2026-10-09T12:01:00.000Z", now)).toBe(0);
    expect(policy.highFitScore).toBe(70);
  });
  it("flags future event-driven successes and malformed calendar dates", () => {
    const i = input();
    i.workflowRuns["oss-bundles.yml"] = [run(10, "success", "2027-01-01T00:00:00.000Z")];
    (i.metrics as { period: { start: string } }).period.start = "2026-02-30";
    const { report } = buildHealthReport(i);
    expect(report.analytics).toBeNull();
    expect(report.findings.some((finding) => finding.area === "oss-bundles.yml" && finding.code === "invalid-time")).toBe(true);
  });
  it("rejects malformed analytics periods without exposing their values", () => {
    const i = input();
    (i.metrics as { period: { start: string } }).period.start = "PRIVATE_SENTINEL";
    const { report } = buildHealthReport(i);
    expect(report.analytics).toBeNull();
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });
});

describe("bounded public health collection", () => {
  it("collects only approved metadata and distinguishes skipped preparation", async () => {
    const get = vi.fn<typeof fetch>(async (request) => {
      const url = String(request);
      if (url.includes("/jobs?"))
        return Response.json({ jobs: [{ steps: [{ name: "Generate tailored application packages", status: "completed", conclusion: "skipped" }] }] });
      if (url.endsWith("build-info.json")) return Response.json({ schemaVersion: 1, revision: "a".repeat(40), context: "production" });
      if (url.endsWith("healthz")) return Response.json({ status: "ok" });
      return Response.json({ workflow_runs: [run()] });
    });
    const result = await collectPublicHealth("PRIVATE_TOKEN", "a".repeat(40), get);
    expect(result.applicationGeneration).toBe("skipped");
    expect(result.deployment.status).toBe("ok");
    expect(result.metricsWorker).toBe("ok");
    expect(get).toHaveBeenCalledTimes(12);
    for (const [url, options] of get.mock.calls) {
      expect(options?.redirect).toBe("manual");
      if (!String(url).startsWith("https://api.github.com")) expect(options?.headers).not.toHaveProperty("authorization");
      expect(String(url)).not.toMatch(/collect$|\/logs|\/artifacts|job-review\.[^/]+\.workers\.dev/);
    }
  });
  it("still returns independent health results when every metadata endpoint fails", async () => {
    const get = vi.fn<typeof fetch>(async () => {
      throw new Error("PRIVATE_TOKEN");
    });
    const result = await collectPublicHealth("PRIVATE_TOKEN", "a".repeat(40), get);
    expect(result.applicationGeneration).toBe("unknown");
    expect(result.deployment.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_TOKEN");
  });
  it("refuses off-origin/private/log endpoints before making a request", async () => {
    const get = vi.fn<typeof fetch>();
    for (const url of [
      "https://evil.example/",
      "https://api.github.com/repos/other/private/actions/runs",
      "https://api.github.com/repos/Thavarshan/thavarshan.com/actions/runs/1/logs"
    ]) {
      await expect(readPublicJson(url, "TOKEN", get)).rejects.toThrow();
    }
    expect(get).not.toHaveBeenCalled();
  });
  it("rejects oversized and redirect responses", async () => {
    for (const response of [new Response("x".repeat(2 * 1024 * 1024 + 1)), new Response("", { status: 302 })]) {
      await expect(readPublicJson("https://thavarshan.com/build-info.json", undefined, async () => response)).rejects.toThrow();
    }
  });
});

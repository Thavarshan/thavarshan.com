import { z } from "zod";
import { loadSnapshot } from "../../../src/features/jobs/snapshot";
import { assessOpportunity, COLLECTOR_VERSION } from "../../../src/features/jobs/opportunities";
import { githubSnapshotSchema } from "../../../src/features/github/github-model";
import { packageRegistrySnapshotSchema } from "../../../src/features/projects/package-registry-model";
import { ledgerSchema } from "../../../src/features/marketing/oss-marketing";
import { snapshotSchema } from "../../../src/features/telemetry/snapshot";

export const repository = "Thavarshan/thavarshan.com";
export const policy = {
  jobsHours: 36,
  sourceHours: 36,
  metricsHours: 216,
  profileHours: 216,
  marketingSnapshotHours: 336,
  activeJobHours: 168,
  highFitScore: 70,
  futureToleranceMs: 300_000
};
export const workflows = [
  { file: "content-refresh.yml", name: "Profile and CV", maxAgeHours: 216 },
  { file: "jobs-refresh.yml", name: "Job collection", maxAgeHours: 36 },
  { file: "applications-refresh.yml", name: "Application preparation", maxAgeHours: 36 },
  { file: "oss-bundles.yml", name: "OSS distribution", maxAgeHours: null },
  { file: "growth-metrics.yml", name: "Growth metrics", maxAgeHours: 216 },
  { file: "deployment-smoke.yml", name: "Production smoke", maxAgeHours: 12 },
  { file: "job-review-deploy.yml", name: "Job review deployment", maxAgeHours: null },
  { file: "site-metrics-deploy.yml", name: "Metrics deployment", maxAgeHours: null },
  { file: "ci.yml", name: "Main CI", maxAgeHours: null }
] as const;
export type WorkflowFile = (typeof workflows)[number]["file"];
const runSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["queued", "in_progress", "completed", "waiting", "pending", "requested"]),
  conclusion: z.enum(["success", "failure", "cancelled", "skipped", "timed_out", "action_required", "neutral", "stale", "startup_failure"]).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type PublicRun = z.infer<typeof runSchema>;
export const baselineSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    knownIds: z.array(z.string().regex(/^[a-f0-9]{20}$/)).max(5000),
    eligibleHighFitIds: z.array(z.string().regex(/^[a-f0-9]{20}$/)).max(5000)
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.knownIds).size === value.knownIds.length &&
      new Set(value.eligibleHighFitIds).size === value.eligibleHighFitIds.length &&
      value.eligibleHighFitIds.every((id) => value.knownIds.includes(id)),
    "Invalid comparison ID sets"
  );
export type HealthBaseline = z.infer<typeof baselineSchema>;
export type Severity = "error" | "warning" | "info";
export interface Finding {
  severity: Severity;
  area: string;
  code: string;
  action: string;
}
export interface ReportInput {
  now: Date;
  workflowRuns: Partial<Record<WorkflowFile, unknown>>;
  applicationGeneration: "ran" | "skipped" | "unknown";
  jobs: unknown;
  github: unknown;
  marketing: unknown;
  registry: unknown;
  metrics: unknown;
  baseline: unknown | null;
  deployment: { status: "ok" | "unavailable" | "revision-mismatch"; revision: string | null };
  metricsWorker: "ok" | "unavailable";
}

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function ageHours(value: string, now: Date): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime() + policy.futureToleranceMs) return null;
  return Math.max(0, Math.round(((now.getTime() - timestamp) / 3_600_000) * 10) / 10);
}

/** External descriptions, titles, notes, errors and raw workflow responses never enter the report. */
export function buildHealthReport(input: ReportInput) {
  if (!Number.isFinite(input.now.getTime())) throw new Error("Invalid report timestamp");
  const findings: Finding[] = [];
  const add = (severity: Severity, area: string, code: string, action: string) => findings.push({ severity, area, code, action });
  const freshness = (area: string, date: string, threshold: number) => {
    const age = ageHours(date, input.now);
    if (age === null) add("error", area, "invalid-time", "Restore a valid timestamp; future data cannot establish freshness.");
    else if (age > threshold) add("warning", area, "stale", "Inspect the latest workflow and merge its validated generated-data PR or rerun the source.");
    return age;
  };
  const workflowHealth = workflows.map((definition) => {
    const parsed = z.array(runSchema).max(20).safeParse(input.workflowRuns[definition.file]);
    if (!parsed.success) {
      add("warning", definition.file, "workflow-unavailable", "Check workflow registration, Actions access and the report's API collection.");
      return { ...definition, status: "unknown", latest: null, lastSuccessfulRun: null, ageHours: null };
    }
    const runs = parsed.data.filter((run) => run.conclusion !== "skipped").sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = runs[0] ?? null;
    const success = runs.find((run) => run.status === "completed" && run.conclusion === "success") ?? null;
    const safeRun = (run: PublicRun | null) =>
      run
        ? { id: run.id, status: run.status, conclusion: run.conclusion, at: run.updated_at, url: `https://github.com/${repository}/actions/runs/${run.id}` }
        : null;
    if (!latest) add("warning", definition.file, "workflow-missing", "Run or configure this workflow; no attempted main run was found.");
    else if (latest.status !== "completed") add("info", definition.file, "workflow-running", "Wait for the current run; its outcome is not yet known.");
    else if (["failure", "timed_out", "action_required", "stale", "startup_failure"].includes(latest.conclusion ?? ""))
      add("error", definition.file, "workflow-failed", "Inspect the linked run and repair the failed step before retrying.");
    else if (latest.conclusion === "cancelled")
      add("warning", definition.file, "workflow-cancelled", "Confirm cancellation was intentional and a replacement run succeeded.");
    const age = success ? freshness(definition.file, success.updated_at, definition.maxAgeHours ?? Infinity) : null;
    if (latest && !success)
      add("warning", definition.file, "no-success-in-window", "No successful main run was found in the bounded history; inspect older history if needed.");
    return {
      ...definition,
      status: latest?.status === "completed" ? latest.conclusion : (latest?.status ?? "missing"),
      latest: safeRun(latest),
      lastSuccessfulRun: safeRun(success),
      ageHours: age
    };
  });

  let jobs: {
    generatedAt: string;
    ageHours: number | null;
    active: number;
    eligible: number;
    unknownEligibility: number;
    highFit: number;
    scoringMismatches: number;
    staleActive: number;
    sources: Array<{ name: string; status: string; records: number | null; held: number | null; rejected: number | null; ageHours: number | null }>;
    eligibleHighFitIds: string[];
    newEligibleHighFitIds: string[] | null;
    newlyDiscoveredHighFitIds: string[] | null;
  } | null = null;
  let nextBaseline: HealthBaseline | null = null;
  const prior = input.baseline === null ? null : baselineSchema.safeParse(input.baseline);
  const baseline = prior?.success && ageHours(prior.data.generatedAt, input.now) !== null ? prior.data : null;
  const invalidBaseline = input.baseline !== null && !baseline;
  if (invalidBaseline) add("error", "comparison", "baseline-invalid", "Restore the last valid committed baseline; do not replace it with partial data.");
  if (baseline && (ageHours(baseline.generatedAt, input.now) ?? Infinity) > policy.metricsHours)
    add("warning", "comparison", "baseline-stale", "Merge the pending validated baseline PR or repair the report publication workflow.");
  if (!baseline) add("info", "comparison", "initial-baseline", "Changes are unknown until a validated baseline PR has been accepted.");
  try {
    const snapshot = loadSnapshot(input.jobs).snapshot;
    const ids = snapshot.opportunities.map((job) => job.id);
    if (ids.length > 5000 || new Set(ids).size !== ids.length || ids.some((id) => !/^[a-f0-9]{20}$/.test(id))) throw new Error("Invalid job IDs");
    const age = freshness("jobs", snapshot.generatedAt, policy.jobsHours);
    const active = snapshot.opportunities.filter((job) => job.status !== "closed");
    const assessments = new Map(active.map((job) => [job.id, assessOpportunity(job, { laravelCurated: job.source === "larajobs" })]));
    const mismatches = active.filter((job) => {
      const assessed = assessments.get(job.id)!;
      return assessed.score !== job.score || assessed.eligibility !== job.eligibility || assessed.sponsorship !== job.sponsorship;
    }).length;
    if (mismatches)
      add(
        "warning",
        "jobs",
        "scoring-drift",
        "Recollect/revalidate jobs with the current deterministic scorer; disputed eligibility is excluded from high-fit opportunities."
      );
    if (snapshot.collectorVersion !== COLLECTOR_VERSION)
      add("warning", "jobs", "collector-version", "Refresh the job snapshot with the current collector version.");
    const sourceNames = ["LaraJobs RSS", "Laravel News", "Remotive", "WeWorkRemotely"];
    const sources = sourceNames.map((name) => {
      const source = snapshot.sources.find((item) => item.name === name);
      if (!source) {
        add("warning", "jobs", "source-missing", "Check collection diagnostics for a missing expected source.");
        return { name, status: "missing", records: null, held: null, rejected: null, ageHours: null };
      }
      if (source.status === "failed") add("error", "jobs", "source-failed", "Inspect collector diagnostics; last-known-good jobs may have been retained.");
      if (source.held) add("warning", "jobs", "source-held", "Source returned an unexpected empty result; retained jobs do not prove current availability.");
      return {
        name,
        status: source.status,
        records: source.recordsFound,
        held: source.held,
        rejected: source.rejected,
        ageHours: freshness("jobs", source.collectedAt, policy.sourceHours)
      };
    });
    const staleActive = active.filter((job) => {
      const age = ageHours(job.lastSeenAt, input.now);
      return age === null || age > policy.activeJobHours;
    }).length;
    if (staleActive) add("warning", "jobs", "stale-active-jobs", "Review jobs not observed recently before preparing an application.");
    const eligible = active.filter((job) => job.eligibility === "eligible" && assessments.get(job.id)!.eligibility === "eligible");
    const highFit = eligible.filter(
      (job) =>
        job.score >= policy.highFitScore &&
        assessments.get(job.id)!.score >= policy.highFitScore &&
        (ageHours(job.lastSeenAt, input.now) ?? Infinity) <= policy.activeJobHours
    );
    const highFitIds = highFit.map((job) => job.id).sort();
    jobs = {
      generatedAt: snapshot.generatedAt,
      ageHours: age,
      active: active.length,
      eligible: eligible.length,
      unknownEligibility: active.filter((job) => job.eligibility === "unknown").length,
      highFit: highFit.length,
      scoringMismatches: mismatches,
      staleActive,
      sources,
      eligibleHighFitIds: highFitIds,
      newEligibleHighFitIds: baseline ? highFitIds.filter((id) => !baseline.eligibleHighFitIds.includes(id)) : null,
      newlyDiscoveredHighFitIds: baseline ? highFitIds.filter((id) => !baseline.knownIds.includes(id)) : null
    };
    if (
      !invalidBaseline &&
      age !== null &&
      age <= policy.jobsHours &&
      mismatches === 0 &&
      snapshot.collectorVersion === COLLECTOR_VERSION &&
      sources.every((source) => source.status === "ok" && source.held === 0 && source.ageHours !== null && source.ageHours <= policy.sourceHours)
    ) {
      nextBaseline = baselineSchema.parse({ schemaVersion: 1, generatedAt: input.now.toISOString(), knownIds: ids.sort(), eligibleHighFitIds: highFitIds });
    } else
      add("warning", "comparison", "baseline-preserved", "No new comparison baseline will be proposed until job collection is fresh, complete and consistent.");
  } catch {
    add("error", "jobs", "jobs-unavailable", "Restore/revalidate the public job snapshot; counts and deltas are unknown, not zero.");
  }

  const github = githubSnapshotSchema.safeParse(input.github);
  if (github.success) freshness("profile", github.data.syncedAt, policy.profileHours);
  else add("error", "profile", "snapshot-unavailable", "Restore the validated public GitHub snapshot.");
  const ledger = ledgerSchema.safeParse(input.marketing);
  if (!ledger.success) add("warning", "marketing", "ledger-unavailable", "Restore the OSS marketing ledger; do not assume no drafts exist.");
  const lastGeneratedAt = ledger.success ? (Object.values(ledger.data.lastGeneratedAt).sort().at(-1) ?? null) : null;
  if (lastGeneratedAt && ageHours(lastGeneratedAt, input.now) === null)
    add("error", "marketing", "invalid-time", "Restore a valid marketing generation timestamp.");
  // No new release/milestone can legitimately mean no new bundle; a quiet ledger is not stale failure.
  const registry = packageRegistrySnapshotSchema.safeParse(input.registry);
  if (registry.success) freshness("marketing-registry", registry.data.syncedAt, policy.marketingSnapshotHours);
  else add("warning", "marketing", "registry-unavailable", "Refresh the package registry snapshot; milestone inputs are unavailable.");
  const marketing = {
    status: ledger.success ? "available" : "unknown",
    generatedBundles: ledger.success ? Object.values(ledger.data.entries).filter((entry) => entry.outcome === "generated").length : null,
    lastGeneratedAt,
    githubSnapshotAt: github.success ? github.data.syncedAt : null,
    registrySnapshotAt: registry.success ? registry.data.syncedAt : null
  };
  if (github.success) freshness("marketing", github.data.syncedAt, policy.marketingSnapshotHours);
  const parsedMetrics = snapshotSchema.safeParse(input.metrics);
  let analytics: {
    generatedAt: string;
    period: { start: string; end: string; isoWeek: string };
    ageHours: number | null;
    events: number;
    daysWithData: number;
    daysInPeriod: number;
    byEvent: Record<string, number>;
  } | null = null;
  if (
    parsedMetrics.success &&
    validDate(parsedMetrics.data.period.start) &&
    validDate(parsedMetrics.data.period.end) &&
    /^[0-9]{4}-W[0-9]{2}$/.test(parsedMetrics.data.period.isoWeek) &&
    ageHours(`${parsedMetrics.data.period.start}T00:00:00.000Z`, input.now) !== null &&
    parsedMetrics.data.period.start <= parsedMetrics.data.period.end &&
    parsedMetrics.data.coverage.daysWithData <= parsedMetrics.data.coverage.daysInPeriod &&
    ageHours(`${parsedMetrics.data.period.end}T00:00:00.000Z`, input.now) !== null
  ) {
    const data = parsedMetrics.data;
    analytics = {
      generatedAt: data.generatedAt,
      period: data.period,
      ageHours: freshness("analytics", data.generatedAt, policy.metricsHours),
      events: data.coverage.events,
      daysWithData: data.coverage.daysWithData,
      daysInPeriod: data.coverage.daysInPeriod,
      byEvent: Object.fromEntries(
        ["cv_download", "contact_cta", "hire_cta", "consulting_cta", "repo_click", "demo_click", "tool_completed"].map((name) => [
          name,
          data.totals.byEvent[name] ?? 0
        ])
      )
    };
    if (data.coverage.daysWithData < data.coverage.daysInPeriod)
      add(
        "warning",
        "analytics",
        "limited-coverage",
        "Quiet days and collection gaps are indistinguishable; action counts are a lower bound, not visitor conversion rates."
      );
  } else add("warning", "analytics", "metrics-unavailable", "Configure/recover the aggregate metrics workflow; missing counts are unknown, not zero.");
  if (input.applicationGeneration === "skipped")
    add(
      "warning",
      "applications",
      "generation-skipped",
      "Scheduled application preparation was skipped; configure the private destination or use manual free preparation."
    );
  if (input.deployment.status !== "ok")
    add(
      "warning",
      "deployment",
      "deployment-unverified",
      "Check the latest production smoke; publishing may be pending or the deployed revision may be stale."
    );
  if (input.metricsWorker !== "ok")
    add("warning", "metrics-worker", "health-unavailable", "Check Worker deployment and its public health endpoint; no synthetic collect event is sent.");
  const report = {
    schemaVersion: 1,
    generatedAt: input.now.toISOString(),
    status: findings.some((finding) => finding.severity === "error")
      ? "attention"
      : findings.some((finding) => finding.severity === "warning")
        ? "watch"
        : "healthy",
    policy,
    comparison: { since: baseline?.generatedAt ?? null, baselineWritable: nextBaseline !== null },
    workflows: workflowHealth,
    jobs,
    marketing,
    analytics,
    applications: {
      generation: input.applicationGeneration,
      preparedCount: null,
      appliedCount: null,
      note: "Private state is not collected; a successful workflow does not establish a package count or submission."
    },
    deployment: {
      status: input.deployment.status,
      revision: input.deployment.revision && /^[a-f0-9]{40}$/.test(input.deployment.revision) ? input.deployment.revision : null
    },
    workers: { metrics: input.metricsWorker, jobReview: "not-collected-access-protected" },
    search: { indexing: "unknown", performance: "unavailable" },
    findings,
    notes: [
      "Only public snapshot data, run metadata and public health responses are collected; no private application/mailbox state, logs or application artifacts.",
      "Workflow history is bounded to 20 main runs per workflow; last success means last found in that window, not an all-time guarantee.",
      "Comparison uses the last accepted baseline PR; pending baseline updates extend the displayed interval.",
      "An event count is neither a visitor count nor a confirmed enquiry. Search Console/Bing ownership and indexing remain owner-authenticated observations."
    ]
  };
  return { report, nextBaseline };
}
export type HealthReport = ReturnType<typeof buildHealthReport>["report"];

export function renderHealthSummary(report: HealthReport) {
  const opportunities = report.jobs?.newEligibleHighFitIds;
  const changes =
    opportunities === null || opportunities === undefined
      ? "Opportunity changes are unknown until a valid baseline exists."
      : opportunities.length
        ? opportunities
            .map(
              (id) =>
                `- Opportunity ID: \`${id}\` (look up in [public job snapshot](https://github.com/${repository}/blob/main/data/jobs.generated.json); review availability and eligibility before applying).`
            )
            .join("\n")
        : "No new eligible high-fit IDs since the accepted baseline.";
  const rows = report.workflows
    .map(
      (workflow) =>
        `| ${workflow.name} | ${workflow.status ?? "unknown"} | ${workflow.lastSuccessfulRun ? `[run ${workflow.lastSuccessfulRun.id}](${workflow.lastSuccessfulRun.url})` : "unknown"} | ${workflow.ageHours ?? "—"} |`
    )
    .join("\n");
  return `# Growth Engine health: ${report.status}\n\nAs of ${report.generatedAt}. Comparison baseline: ${report.comparison.since ?? "unavailable; initial deltas unknown"}.\n\n| Workflow | Latest state | Last successful workflow run | Age (hours) |\n| --- | --- | --- | --- |\n${rows}\n\n## Jobs\n\nActive: ${report.jobs?.active ?? "unknown"}; eligible: ${report.jobs?.eligible ?? "unknown"}; high-fit: ${report.jobs?.highFit ?? "unknown"}; unknown eligibility: ${report.jobs?.unknownEligibility ?? "unknown"}.\nNewly eligible/high-fit: ${report.jobs?.newEligibleHighFitIds?.length ?? "unknown"}; newly discovered high-fit: ${report.jobs?.newlyDiscoveredHighFitIds?.length ?? "unknown"}.\n\n${report.jobs?.sources.map((source) => `- ${source.name}: ${source.status}; records ${source.records ?? "unknown"}; retained ${source.held ?? "unknown"}; age ${source.ageHours ?? "unknown"}h.`).join("\n") ?? "Source health unavailable."}\n\n${changes}\n\n## Growth and preparation\n\nMarketing drafts recorded: ${report.marketing.generatedBundles ?? "unknown"}; latest generation: ${report.marketing.lastGeneratedAt ?? "none recorded / unknown"}.\nAnalytics period: ${report.analytics ? `${report.analytics.period.start}–${report.analytics.period.end}` : "unavailable"}; actions ${report.analytics?.events ?? "unknown"}; days with events ${report.analytics?.daysWithData ?? "unknown"}/${report.analytics?.daysInPeriod ?? "unknown"}.\nApplication generation: ${report.applications.generation}; private prepared/applied counts unavailable.\nProduction: ${report.deployment.status}; metrics Worker: ${report.workers.metrics}; private review health not collected.\nSearch indexing/performance: unknown/unavailable.\n\n## Maintenance\n\n${report.findings.map((finding) => `- **${finding.severity}** ${finding.area} / ${finding.code}: ${finding.action}`).join("\n") || "No maintenance findings."}\n\n${report.notes.map((note) => `- ${note}`).join("\n")}\n`;
}

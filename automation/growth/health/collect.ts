import { readFile, mkdir, writeFile, appendFile, rename, rm } from "node:fs/promises";
import { z } from "zod";
import { buildHealthReport, renderHealthSummary, repository, workflows, type ReportInput, type WorkflowFile } from "./report";

const maxBytes = 2 * 1024 * 1024;
/** Fixed destinations only, no redirects, no logging response bodies or credentials. */
export async function readPublicJson(url: string, token?: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const parsed = new URL(url);
  if (
    parsed.origin !== "https://api.github.com" &&
    !["https://thavarshan.com/build-info.json", "https://site-metrics.tjthavarshan.workers.dev/healthz"].includes(url)
  )
    throw new Error("Unapproved report endpoint");
  if (
    parsed.origin === "https://api.github.com" &&
    !(
      /^\/repos\/Thavarshan\/thavarshan\.com\/actions\/workflows\/[a-z-]+\.yml\/runs$/.test(parsed.pathname) ||
      /^\/repos\/Thavarshan\/thavarshan\.com\/actions\/runs\/[0-9]+\/jobs$/.test(parsed.pathname)
    )
  )
    throw new Error("Only this public repository's Actions metadata may be read");
  const response = await fetcher(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json", ...(token && parsed.origin === "https://api.github.com" ? { authorization: `Bearer ${token}` } : {}) }
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error("Public metadata unavailable");
  }
  if (!response.body) throw new Error("Empty public metadata");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("Metadata exceeds report limit");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
async function localJson(path: string): Promise<unknown> {
  try {
    const content = await readFile(path);
    if (content.length > maxBytes) return undefined;
    return JSON.parse(content.toString("utf8"));
  } catch {
    return undefined;
  }
}
const runsEnvelope = z.object({ workflow_runs: z.array(z.unknown()).max(20) });
const jobsEnvelope = z.object({
  jobs: z.array(z.object({ steps: z.array(z.object({ name: z.string(), status: z.string(), conclusion: z.string().nullable() })).optional() })).max(30)
});

export async function collectPublicHealth(token: string | undefined, expectedRevision: string | undefined, fetcher: typeof fetch = fetch) {
  const workflowRuns: Partial<Record<WorkflowFile, unknown>> = {};
  // Sequential: at most nine workflow queries, one application-step query and two health queries.
  for (const workflow of workflows) {
    try {
      const data = await readPublicJson(
        `https://api.github.com/repos/${repository}/actions/workflows/${workflow.file}/runs?branch=main&per_page=20`,
        token,
        fetcher
      );
      workflowRuns[workflow.file] = runsEnvelope.parse(data).workflow_runs;
    } catch {
      workflowRuns[workflow.file] = undefined;
    }
  }
  let applicationGeneration: ReportInput["applicationGeneration"] = "unknown";
  const applicationRuns = workflowRuns["applications-refresh.yml"];
  const candidate = z.array(z.object({ id: z.number().int().positive(), created_at: z.string().datetime() })).safeParse(applicationRuns);
  const run = candidate.success ? candidate.data.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] : null;
  if (run) {
    try {
      const data = jobsEnvelope.parse(
        await readPublicJson(`https://api.github.com/repos/${repository}/actions/runs/${run.id}/jobs?per_page=30`, token, fetcher)
      );
      const step = data.jobs.flatMap((job) => job.steps ?? []).find((item) => item.name === "Generate tailored application packages");
      if (step?.conclusion === "skipped") applicationGeneration = "skipped";
      else if (step?.status === "completed" && step.conclusion === "success") applicationGeneration = "ran";
    } catch {
      /* Counts and generation remain unknown, never inferred from an overall green run. */
    }
  }
  let deployment: ReportInput["deployment"] = { status: "unavailable", revision: null };
  try {
    const data = z
      .object({ schemaVersion: z.literal(1), revision: z.string().regex(/^[a-f0-9]{40}$/), context: z.literal("production") })
      .parse(await readPublicJson("https://thavarshan.com/build-info.json", undefined, fetcher));
    deployment = { status: expectedRevision && data.revision !== expectedRevision ? "revision-mismatch" : "ok", revision: data.revision };
  } catch {
    /* A blocked/redirecting/malformed endpoint is not healthy. */
  }
  let metricsWorker: ReportInput["metricsWorker"] = "unavailable";
  try {
    z.object({ status: z.literal("ok") }).parse(await readPublicJson("https://site-metrics.tjthavarshan.workers.dev/healthz", undefined, fetcher));
    metricsWorker = "ok";
  } catch {
    /* Private review endpoints and analytics collect endpoints are never called. */
  }
  return { workflowRuns, applicationGeneration, deployment, metricsWorker };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--offline", "--write-baseline"].includes(arg))) throw new Error("Use --offline and/or --write-baseline only");
  const offline = args.includes("--offline");
  const publicData = offline
    ? {
        workflowRuns: {},
        applicationGeneration: "unknown" as const,
        deployment: { status: "unavailable" as const, revision: null },
        metricsWorker: "unavailable" as const
      }
    : await collectPublicHealth(process.env.GITHUB_TOKEN, process.env.GITHUB_SHA);
  const baseline = await localJson("data/growth-health/baseline.json");
  const [jobs, github, marketing, metrics, registry] = await Promise.all([
    localJson("data/jobs.generated.json"),
    localJson("data/github.generated.json"),
    localJson("marketing/oss-ledger.json"),
    localJson("data/growth/latest.json"),
    localJson("data/package-registry.generated.json")
  ]);
  const { report, nextBaseline } = buildHealthReport({
    now: new Date(),
    ...publicData,
    jobs,
    github,
    marketing,
    metrics,
    registry,
    baseline: baseline === undefined ? ((await baselineMissing()) ? null : {}) : baseline
  });
  await mkdir("test-results/growth-health", { recursive: true });
  await writeFile("test-results/growth-health/report.json", JSON.stringify(report, null, 2) + "\n");
  const summary = renderHealthSummary(report);
  await writeFile("test-results/growth-health/summary.md", summary);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  const baselineWritten = args.includes("--write-baseline") && nextBaseline !== null;
  if (baselineWritten) {
    await mkdir("data/growth-health", { recursive: true });
    const temporary = `data/growth-health/baseline-${process.pid}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(nextBaseline, null, 2) + "\n");
      await rename(temporary, "data/growth-health/baseline.json");
    } finally {
      await rm(temporary, { force: true });
    }
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `baseline_written=${baselineWritten}\n`);
  // A degraded subsystem is the report's result, not a reason to lose the summary/artifact.
}
async function baselineMissing() {
  const { stat } = await import("node:fs/promises");
  try {
    await stat("data/growth-health/baseline.json");
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}
if (import.meta.url === `file://${process.argv[1]}`)
  await main().catch(() => {
    console.error("Growth report could not be written; previous comparison baseline was preserved.");
    process.exitCode = 1;
  });

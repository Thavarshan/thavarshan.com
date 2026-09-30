import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { site } from "../../src/features/profile/site";
import { githubSnapshotSchema } from "../../src/features/github/github-model";
import {
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_MAX_PER_RUN,
  GENERATOR_VERSION,
  bundleDirectoryName,
  buildBundle,
  describeProgress,
  detectEvents,
  findUnverifiedNumbers,
  ledgerSchema,
  type Decision,
  type DetectResult,
  type Ledger,
  type Snapshots
} from "../../src/features/marketing/oss-marketing";
import { packageRegistrySnapshotSchema } from "../../src/features/projects/package-registry";
import { writeJsonAtomic } from "../../src/shared/node/fs";

const ledgerPath = resolve("marketing/oss-ledger.json");
const outputRoot = resolve("marketing/oss");

interface Args {
  dryRun: boolean;
  backfill: boolean;
  maxPerRun: number;
  cooldownDays: number;
}

export function parseArgs(argv: string[]): Args {
  const number = (flag: string, fallback: number) => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = Number(argv[index + 1]);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${flag} needs a non-negative whole number`);
    return value;
  };
  return { dryRun: argv.includes("--dry-run"), backfill: argv.includes("--backfill"), maxPerRun: number("--max", DEFAULT_MAX_PER_RUN), cooldownDays: number("--cooldown", DEFAULT_COOLDOWN_DAYS) };
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function readLedger(): Promise<Ledger | null> {
  let raw: string;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = ledgerSchema.safeParse(JSON.parse(raw));
  // An unreadable ledger must stop the run: treating it as "first run" would re-announce everything.
  if (!parsed.success) throw new Error(`Refusing to run: ${ledgerPath} is invalid (${parsed.error.issues[0]?.message}). Restore it from git.`);
  return parsed.data;
}

const outcomeLabel: Record<Decision["outcome"], string> = {
  generate: "✅ drafted",
  baseline: "📌 baseline",
  skip: "⏭️ skipped",
  defer: "⏳ held",
  superseded: "↪️ superseded"
};

export function renderSummary(result: DetectResult, progress: string[], args: Args, written: boolean): string {
  const lines = ["## OSS distribution bundles", ""];
  const generated = result.decisions.filter((decision) => decision.outcome === "generate");
  lines.push(
    generated.length > 0
      ? `**${generated.length} draft bundle${generated.length === 1 ? "" : "s"} ${written ? "written to `marketing/oss/`" : "would be written (dry run)"}.** Review them; nothing is posted automatically.`
      : "**No drafts generated this run.** This is expected most weeks: only a new minor/major release or a newly crossed milestone qualifies.",
    ""
  );
  for (const note of result.notes) lines.push(`> ${note}`, "");
  const baselines = result.decisions.filter((decision) => decision.outcome === "baseline");
  const notable = result.decisions.filter((decision) => decision.outcome !== "baseline");
  if (baselines.length > 0) {
    lines.push(`📌 ${baselines.length} milestone${baselines.length === 1 ? "" : "s"}/version${baselines.length === 1 ? "" : "s"} already true when tracking began were recorded as the baseline and will not be announced.`, "");
  }
  if (notable.length > 0) {
    lines.push("| Event | Decision | Why |", "| --- | --- | --- |");
    for (const decision of notable) lines.push(`| \`${decision.eventId}\` | ${outcomeLabel[decision.outcome]} | ${decision.reason} |`);
    lines.push("");
  }
  if (progress.length > 0) lines.push("### Where things stand", "", ...progress.map((line) => `- ${line}`), "");
  lines.push(`_Generator ${GENERATOR_VERSION} · max ${args.maxPerRun}/run · cooldown ${args.cooldownDays} days${args.backfill ? " · backfill" : ""}${args.dryRun ? " · dry run" : ""}_`, "");
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const github = githubSnapshotSchema.parse(await readJson(resolve("data/github.generated.json")));
  const registry = packageRegistrySnapshotSchema.parse(await readJson(resolve("data/package-registry.generated.json")));
  const snapshots: Snapshots = { github, registry };
  const previous = await readLedger();
  const now = new Date();

  const result = detectEvents(snapshots, previous, { now, maxPerRun: args.maxPerRun, cooldownDays: args.cooldownDays, backfill: args.backfill });
  const projectsByRepo = new Map(github.projects.map((project) => [project.repository, project]));

  // Build and verify every bundle BEFORE touching disk: a failed check aborts the run with no side effects.
  const bundles = result.decisions.flatMap((decision) => {
    if (decision.outcome !== "generate" || !decision.event) return [];
    const files = buildBundle(decision.event, { siteUrl: site.url, generatedAt: now.toISOString(), project: projectsByRepo.get(decision.event.repository) });
    const text = Object.entries(files).filter(([name]) => name.endsWith(".md")).map(([, content]) => content).join("\n");
    const unverified = findUnverifiedNumbers(text, decision.event);
    if (unverified.length > 0) throw new Error(`Bundle ${decision.eventId} contains numbers with no evidence (${unverified.join(", ")}); refusing to write drafts.`);
    return [{ event: decision.event, files }];
  });

  const progress = describeProgress(snapshots, result.nextLedger);
  const summary = renderSummary(result, progress, args, !args.dryRun);
  console.log(summary);

  if (args.dryRun) {
    for (const { event, files } of bundles) {
      console.log(`\n===== ${bundleDirectoryName(event.id)} =====`);
      for (const [name, content] of Object.entries(files)) console.log(`\n--- ${name} ---\n${content}`);
    }
  } else {
    for (const { event, files } of bundles) {
      const directory = resolve(outputRoot, bundleDirectoryName(event.id));
      await mkdir(directory, { recursive: true });
      for (const [name, content] of Object.entries(files)) await writeFile(resolve(directory, name), content, "utf8");
    }
    // The ledger is written last, so an interrupted run never marks an event as done without its drafts.
    await writeJsonAtomic(ledgerPath, result.nextLedger);
  }

  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

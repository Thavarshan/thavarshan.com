import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { opportunitySnapshotSchema, type Opportunity } from "../../lib/job-opportunities";
import { readState, writeState, type ApplicationStateEntry } from "./state";

function run(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed with status ${result.status}`);
}

function runCapture(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function extractFlaggedTerms(summaryMarkdown: string): string[] {
  const marker = "## ⚠️ Review these terms before sending";
  const startIndex = summaryMarkdown.indexOf(marker);
  if (startIndex === -1) return [];

  const rest = summaryMarkdown.slice(startIndex + marker.length);
  const nextHeadingIndex = rest.indexOf("\n## ");
  const section = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

async function readJobsById(): Promise<Map<string, Opportunity>> {
  const raw = JSON.parse(await readFile(resolve("data/jobs.generated.json"), "utf8"));
  const snapshot = opportunitySnapshotSchema.parse(raw);
  return new Map(snapshot.opportunities.map((job) => [job.id, job]));
}

function printPackage(cloneDir: string, entry: ApplicationStateEntry, job: Opportunity | undefined, flaggedTerms: string[]) {
  const packageDir = resolve(cloneDir, entry.opportunityId);

  console.log(`\n${"=".repeat(70)}`);
  if (job) {
    console.log(`${job.title} @ ${job.company ?? "Unknown company"}`);
    console.log(`Score: ${job.score} | Eligibility: ${job.eligibility} | Work arrangement: ${job.workArrangement}`);
    if (job.status === "closed") console.log("⚠ This listing is now marked CLOSED in data/jobs.generated.json.");
    if (job.salary) console.log(`Salary: ${job.salary}`);
    if (job.location) console.log(`Location: ${job.location}`);
    console.log(`Apply: ${job.canonicalUrl}`);
  } else {
    console.log(`(opportunity ${entry.opportunityId} is no longer present in data/jobs.generated.json)`);
  }
  console.log(`CV: ${resolve(packageDir, "cv.pdf")}`);
  console.log(`Cover letter: ${resolve(packageDir, "cover-letter.pdf")}`);
  if (flaggedTerms.length > 0) {
    console.log(`⚠ Flagged terms to verify before sending: ${flaggedTerms.join(", ")}`);
  }
  console.log("=".repeat(70));
  process.stdout.write("[a]pplied  [s]kip  [q]uit > ");
}

async function main() {
  const cloneDirArg = process.argv[2];
  if (!cloneDirArg) {
    throw new Error("Usage: npm run applications:review -- /path/to/local/clone/of/job-applications");
  }
  const cloneDir = resolve(cloneDirArg);

  const state = await readState(cloneDir);
  const jobsById = await readJobsById();

  const pending = state.entries
    .filter((entry) => entry.status === "pending")
    .sort((a, b) => (jobsById.get(b.opportunityId)?.score ?? 0) - (jobsById.get(a.opportunityId)?.score ?? 0));

  if (pending.length === 0) {
    console.log("No pending application packages to review.");
    return;
  }

  // All async work (reading each package's summary.md) must happen before the readline interface
  // is created and iterated below — starting the `for await` loop after any intervening `await`
  // causes Node to miss piped/buffered input entirely (confirmed via a minimal repro; this is a
  // real readline quirk, not specific to this script). So everything the loop needs to print is
  // prefetched into memory first, and the loop body itself stays fully synchronous.
  const flaggedTermsById = new Map<string, string[]>();
  for (const entry of pending) {
    const summaryMarkdown = await readFile(resolve(cloneDir, entry.opportunityId, "summary.md"), "utf8").catch(() => "");
    flaggedTermsById.set(entry.opportunityId, extractFlaggedTerms(summaryMarkdown));
  }

  console.log(`${pending.length} pending package(s) to review. For each: [a]pplied, [s]kip, [q]uit.`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let changed = false;
  let index = 0;

  printPackage(cloneDir, pending[index], jobsById.get(pending[index].opportunityId), flaggedTermsById.get(pending[index].opportunityId) ?? []);

  for await (const rawLine of rl) {
    const answer = rawLine.trim().toLowerCase();
    const entry = pending[index];

    if (answer === "a" || answer === "applied") {
      entry.status = "applied";
      entry.respondedAt = new Date().toISOString();
      changed = true;
      console.log("Marked applied.");
      index++;
    } else if (answer === "s" || answer === "skip") {
      entry.status = "skipped";
      entry.respondedAt = new Date().toISOString();
      changed = true;
      console.log("Marked skipped.");
      index++;
    } else if (answer === "q" || answer === "quit") {
      break;
    } else {
      console.log('Please enter "a", "s", or "q".');
      process.stdout.write("[a]pplied  [s]kip  [q]uit > ");
      continue;
    }

    if (index >= pending.length) break;
    printPackage(cloneDir, pending[index], jobsById.get(pending[index].opportunityId), flaggedTermsById.get(pending[index].opportunityId) ?? []);
  }

  rl.close();

  if (!changed) {
    console.log("\nNo changes to save.");
    return;
  }

  await writeState(cloneDir, state);
  console.log("\nSaving and pushing state.json...");
  run("git", ["-C", cloneDir, "add", "state.json"]);
  const status = runCapture("git", ["-C", cloneDir, "status", "--porcelain", "--", "state.json"]);
  if (status) {
    run("git", ["-C", cloneDir, "commit", "-m", "Update application review state"]);
    run("git", ["-C", cloneDir, "push"]);
    console.log("Pushed updated state.json.");
  } else {
    console.log("state.json unchanged after write; nothing to push.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

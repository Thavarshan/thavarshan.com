import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { validateCvTailoringPlan } from "../../lib/application-tailoring";
import { renderCoverLetterLatex } from "../../lib/cover-letter-latex";
import { githubSnapshotSchema, type GitHubSnapshot } from "../../lib/github-model";
import { scanForUnlistedTerms } from "../../lib/hallucination-check";
import { opportunitySnapshotSchema, type Opportunity } from "../../lib/job-opportunities";
import { renderResumeLatex } from "../../lib/latex";
import { parseProfessionalProfile, type ProfessionalProfile } from "../../lib/profile-schema";
import { compileLatexToPdf } from "../cv/build";
import { generateTailoringAndCoverLetter, type RawTailoringResult } from "./openai-client";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { applicationsRepoSlug, clonePrivateRepo, commitAndPush } from "./private-repo";

const DEFAULT_MODEL = "gpt-4o-mini";
const MIN_SCORE = Number(process.env.APPLICATIONS_MIN_SCORE ?? 60);
const MAX_NEW_PACKAGES_PER_RUN = Number(process.env.APPLICATIONS_MAX_PER_RUN ?? 5);
const buildDirRelative = ".applications-build";

const stateSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(z.object({
    opportunityId: z.string(),
    inputHash: z.string(),
    generatedAt: z.string().datetime(),
    model: z.string()
  }))
});
type State = z.infer<typeof stateSchema>;

async function readJson<T>(path: string, parse: (value: unknown) => T): Promise<T> {
  return parse(JSON.parse(await readFile(resolve(path), "utf8")));
}

async function readState(dir: string): Promise<State> {
  try {
    return stateSchema.parse(JSON.parse(await readFile(resolve(dir, "state.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, entries: [] };
    console.warn(`Existing application state does not match the current schema; starting fresh: ${error instanceof Error ? error.message : error}`);
    return { schemaVersion: 1, entries: [] };
  }
}

function computeInputHash(job: Opportunity): string {
  const payload = JSON.stringify({
    title: job.title,
    company: job.company,
    descriptionText: job.descriptionText,
    tags: job.tags,
    score: job.score,
    salary: job.salary
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 20);
}

function toHighlightSelectionsRecord(items: RawTailoringResult["highlightSelections"]): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const item of items) {
    if (typeof item.experienceId === "string") record[item.experienceId] = item.highlights ?? [];
  }
  return record;
}

function buildAllowlist(profile: ProfessionalProfile, github: GitHubSnapshot, job: Opportunity): string[] {
  return [
    profile.identity.name,
    ...profile.experience.flatMap((role) => [role.company, role.role]),
    ...profile.education.map((entry) => entry.institution),
    ...profile.certifications.map((entry) => entry.name),
    ...profile.certifications.map((entry) => entry.authority).filter((value): value is string => Boolean(value)),
    ...profile.professionalProjects.map((project) => project.name),
    ...profile.skills.map((skill) => skill.name),
    ...github.projects.map((project) => project.name),
    job.company ?? "",
    job.title,
    ...job.tags
  ];
}

function buildSummaryMarkdown(params: {
  job: Opportunity;
  warnings: string[];
  flaggedTerms: string[];
  model: string;
  generatedAt: string;
}): string {
  const { job, warnings, flaggedTerms, model, generatedAt } = params;

  const lines: string[] = [
    `# ${job.title}${job.company ? ` @ ${job.company}` : ""}`,
    "",
    "**AI-drafted — review before sending.**",
    "",
    `- Apply: ${job.canonicalUrl}`,
    `- Score: ${job.score} · Eligibility: ${job.eligibility} · Work arrangement: ${job.workArrangement}`,
    ...(job.salary ? [`- Salary: ${job.salary}`] : []),
    ...(job.location ? [`- Location: ${job.location}`] : []),
    `- Generated: ${generatedAt} (model: ${model})`,
    "",
    "## Why this was selected",
    ...(job.reasons.length > 0 ? job.reasons.map((reason) => `- ${reason}`) : ["_No specific reasons recorded._"])
  ];

  if (flaggedTerms.length > 0) {
    lines.push(
      "",
      "## ⚠️ Review these terms before sending",
      "The cover letter mentions the following, which don't appear in your profile or this job posting. Verify they're accurate:",
      ...flaggedTerms.map((term) => `- ${term}`)
    );
  }

  if (warnings.length > 0) {
    lines.push("", "## Tailoring notes", ...warnings.map((warning) => `- ${warning}`));
  }

  lines.push("", "## Files", "- `cv.pdf` — tailored CV variant", "- `cover-letter.pdf` — AI-drafted cover letter");

  return `${lines.join("\n")}\n`;
}

export async function generateApplications() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const deployKey = process.env.APPLICATIONS_REPO_DEPLOY_KEY;

  if (!openaiApiKey || !deployKey) {
    console.log("OPENAI_API_KEY or APPLICATIONS_REPO_DEPLOY_KEY is not set; skipping application generation.");
    return;
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const jobs = await readJson("data/jobs.generated.json", (value) => opportunitySnapshotSchema.parse(value));
  const profile = await readJson("data/profile.generated.json", parseProfessionalProfile);
  const github = await readJson("data/github.generated.json", (value) => githubSnapshotSchema.parse(value));

  console.log(`Cloning ${applicationsRepoSlug}...`);
  const repoDir = await clonePrivateRepo(deployKey);
  const state = await readState(repoDir);
  const stateById = new Map(state.entries.map((entry) => [entry.opportunityId, entry]));

  const candidates = jobs.opportunities
    .filter((job) => job.eligibility === "eligible" && job.status !== "closed" && job.score >= MIN_SCORE)
    .filter((job) => {
      const existing = stateById.get(job.id);
      return !existing || existing.inputHash !== computeInputHash(job);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEW_PACKAGES_PER_RUN);

  console.log(`${candidates.length} candidate(s) selected for tailored application packages (min score ${MIN_SCORE}, cap ${MAX_NEW_PACKAGES_PER_RUN}).`);

  let generated = 0;
  let failed = 0;

  for (const job of candidates) {
    try {
      console.log(`Generating package for "${job.title}" @ ${job.company ?? "unknown company"} (score ${job.score})...`);

      const raw = await generateTailoringAndCoverLetter({
        apiKey: openaiApiKey,
        model,
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt({ profile, job })
      });

      const sanitized = validateCvTailoringPlan(
        {
          emphasizedSkillCategories: raw.emphasizedSkillCategories,
          experienceOrder: raw.experienceOrder,
          highlightSelections: toHighlightSelectionsRecord(raw.highlightSelections),
          reviewFlags: raw.reviewFlags
        },
        profile
      );

      const allowlist = buildAllowlist(profile, github, job);
      const flaggedTerms = scanForUnlistedTerms(raw.coverLetterBody, allowlist);

      const jobBuildDirRelative = `${buildDirRelative}/${job.id}`;
      await mkdir(resolve(jobBuildDirRelative), { recursive: true });
      const sourceDateEpoch = Math.floor(Date.now() / 1000);

      const cvTexRelative = `${jobBuildDirRelative}/cv.tex`;
      await writeFile(resolve(cvTexRelative), renderResumeLatex(profile, github, sanitized), "utf8");
      const cvPdfPath = await compileLatexToPdf(cvTexRelative, jobBuildDirRelative, sourceDateEpoch);

      const coverLetterTexRelative = `${jobBuildDirRelative}/cover-letter.tex`;
      await writeFile(
        resolve(coverLetterTexRelative),
        renderCoverLetterLatex(profile, { title: job.title, company: job.company }, raw.coverLetterBody, new Date()),
        "utf8"
      );
      const coverLetterPdfPath = await compileLatexToPdf(coverLetterTexRelative, jobBuildDirRelative, sourceDateEpoch);

      const targetDir = resolve(repoDir, job.id);
      await mkdir(targetDir, { recursive: true });
      await copyFile(cvPdfPath, resolve(targetDir, "cv.pdf"));
      await copyFile(coverLetterPdfPath, resolve(targetDir, "cover-letter.pdf"));

      const generatedAt = new Date().toISOString();
      await writeFile(
        resolve(targetDir, "summary.md"),
        buildSummaryMarkdown({ job, warnings: [...sanitized.warnings, ...sanitized.reviewFlags], flaggedTerms, model, generatedAt }),
        "utf8"
      );

      stateById.set(job.id, { opportunityId: job.id, inputHash: computeInputHash(job), generatedAt, model });
      generated++;
    } catch (error) {
      failed++;
      console.error(`Failed to generate package for "${job.title}": ${error instanceof Error ? error.message : error}`);
    }
  }

  const nextState: State = { schemaVersion: 1, entries: [...stateById.values()] };
  await writeFile(resolve(repoDir, "state.json"), `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  const pushed = await commitAndPush(repoDir, deployKey, `Generate ${generated} tailored application package(s)`);
  console.log(`Generated ${generated} package(s), ${failed} failed. ${pushed ? "Pushed to" : "No changes to push to"} ${applicationsRepoSlug}.`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## Application packages",
      "",
      `- Candidates considered: ${candidates.length}`,
      `- Generated: ${generated}`,
      `- Failed: ${failed}`,
      `- Pushed: ${pushed ? "yes" : "no changes"}`
    ];
    await writeFile(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateApplications().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

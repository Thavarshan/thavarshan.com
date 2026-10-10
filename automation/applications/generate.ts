import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCvTailoringPlan } from "../../src/features/cv/tailoring";
import { renderCoverLetterLatex } from "../../src/features/applications/cover-letter-latex";
import { githubSnapshotSchema, type GitHubSnapshot } from "../../src/features/github/github-model";
import { scanForUnlistedTerms } from "../../src/features/applications/hallucination-check";
import { opportunitySnapshotSchema, type Opportunity } from "../../src/features/jobs/opportunities";
import { renderResumeLatex } from "../../src/features/cv/latex";
import { parseProfessionalProfile, type ProfessionalProfile } from "../../src/features/profile/profile-schema";
import { compileLatexToPdf } from "../cv/build";
import { prepareApplication, TEMPLATE_VERSION, escapeApplicationMarkdown as md } from "../../src/features/applications/template";
import { createGroqApplicationClient, groqConfiguration, GROQ_MODEL, GROQ_GENERATOR_VERSION, GroqFailure, type RawTailoringResult } from "./groq-client";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { applicationsRepoSlug, clonePrivateRepo, commitAndPush } from "./private-repo";
import { readState, writeState, type ApplicationState } from "./state";

const MIN_SCORE = Number(process.env.APPLICATIONS_MIN_SCORE ?? 60);
const MAX_NEW_PACKAGES_PER_RUN = Number(process.env.APPLICATIONS_MAX_PER_RUN ?? 5);
const buildDirRelative = ".applications-build";

async function readJson<T>(path: string, parse: (value: unknown) => T): Promise<T> {
  return parse(JSON.parse(await readFile(resolve(path), "utf8")));
}

export function computeInputHash(job: Opportunity, profile: ProfessionalProfile, github: GitHubSnapshot, model: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: TEMPLATE_VERSION,
        job: { ...job, firstSeenAt: undefined, lastSeenAt: undefined },
        profile: { ...profile, modifiedAt: undefined, sources: undefined },
        github: { projects: github.projects.map((project) => ({ ...project, updatedAt: undefined, stars: undefined, forks: undefined })) },
        model
      })
    )
    .digest("hex")
    .slice(0, 20);
}

export function applicationMode(env: Record<string, string | undefined>): "template" | "ai" {
  const mode = env.APPLICATIONS_MODE || "template";
  if (mode !== "template" && mode !== "ai") throw new Error("Invalid application mode");
  if (mode === "ai") groqConfiguration(env);
  return mode;
}

export function selectedJobId(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const id = value.trim().toLowerCase();
  if (!/^[a-f0-9]{20}$/.test(id)) throw new Error("Job ID must be a normalized 20-character snapshot ID");
  return id;
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

function buildSummaryMarkdown(params: { job: Opportunity; warnings: string[]; flaggedTerms: string[]; model: string; generatedAt: string }): string {
  const { job, warnings, flaggedTerms, model, generatedAt } = params;

  const lines: string[] = [
    `# ${md(job.title)}${job.company ? ` @ ${md(job.company)}` : ""}`,
    "",
    "**Draft — review before sending.**",
    "",
    `- Apply: ${job.canonicalUrl}`,
    `- Score: ${job.score} · Eligibility: ${job.eligibility} · Work arrangement: ${job.workArrangement}`,
    ...(job.salary ? [`- Salary: ${md(job.salary)}`] : []),
    ...(job.location ? [`- Location: ${md(job.location)}`] : []),
    `- Generated: ${generatedAt} (model: ${model})`,
    "",
    "## Why this was selected",
    ...(job.reasons.length > 0 ? job.reasons.map((reason) => `- ${md(reason)}`) : ["_No specific reasons recorded._"])
  ];

  if (flaggedTerms.length > 0) {
    lines.push(
      "",
      "## ⚠️ Review these terms before sending",
      "The cover letter mentions the following, which don't appear in your profile or this job posting. Verify they're accurate:",
      ...flaggedTerms.map((term) => `- ${md(term)}`)
    );
  }

  if (warnings.length > 0) {
    lines.push("", "## Tailoring notes", ...warnings.map((warning) => `- ${md(warning)}`));
  }

  lines.push("", "## Files", "- `cv.pdf` — tailored CV variant", "- `cover-letter.pdf` — draft cover letter");

  return `${lines.join("\n")}\n`;
}

interface RunReport {
  mode: string;
  stage: string;
  outcome: "disabled" | "no-op" | "published" | "failed";
  providerAccess: boolean;
  diagnostic?: string;
  metrics?: { requests: number; inputTokens: number; outputTokens: number };
}

async function generateApplicationsInternal(report: RunReport) {
  if (process.env.APPLICATIONS_AUTOMATION_ENABLED === "false") {
    report.outcome = "disabled";
    return;
  }
  if (process.env.APPLICATIONS_AUTOMATION_ENABLED && process.env.APPLICATIONS_AUTOMATION_ENABLED !== "true")
    throw new Error("Invalid automation enable setting");
  const mode = applicationMode(process.env);
  const requestedId = selectedJobId(process.env.APPLICATIONS_JOB_ID);
  report.mode = mode;
  const deployKey = process.env.APPLICATIONS_REPO_DEPLOY_KEY;
  if (!deployKey) throw new Error("Private repository deploy key is required");
  if (
    !Number.isInteger(MIN_SCORE) ||
    MIN_SCORE < 0 ||
    MIN_SCORE > 100 ||
    !Number.isInteger(MAX_NEW_PACKAGES_PER_RUN) ||
    MAX_NEW_PACKAGES_PER_RUN < 1 ||
    MAX_NEW_PACKAGES_PER_RUN > 5
  ) {
    throw new Error("Invalid application selection limits");
  }
  if (applicationsRepoSlug.toLowerCase() === "thavarshan/thavarshan.com") throw new Error("Application output must use the separate private repository");
  const model = mode === "template" ? TEMPLATE_VERSION : `${GROQ_GENERATOR_VERSION}:${GROQ_MODEL}`;
  const ai = mode === "ai" ? createGroqApplicationClient(groqConfiguration(process.env).apiKey) : undefined;
  if (ai) {
    report.stage = "provider access";
    report.metrics = ai.metrics;
    await ai.verifyAccess();
    report.providerAccess = true;
  }
  report.stage = "snapshot validation";

  const jobs = await readJson("data/jobs.generated.json", (value) => opportunitySnapshotSchema.parse(value));
  const profile = await readJson("data/profile.generated.json", parseProfessionalProfile);
  const github = await readJson("data/github.generated.json", (value) => githubSnapshotSchema.parse(value));

  if (requestedId && !jobs.opportunities.some((job) => job.id === requestedId && job.eligibility === "eligible" && job.status !== "closed")) {
    throw new Error("Selected job is missing, closed or not eligible; confirm eligibility before preparing a package");
  }
  report.stage = "private storage";
  console.log("Opening private application repository...");
  const repoDir = await clonePrivateRepo(deployKey);
  const state = await readState(repoDir);
  const stateById = new Map(state.entries.map((entry) => [entry.opportunityId, entry]));

  const candidates = jobs.opportunities
    .filter((job) => job.eligibility === "eligible" && job.status !== "closed" && (requestedId ? job.id === requestedId : job.score >= MIN_SCORE))
    .filter((job) => stateById.get(job.id)?.status !== "applied")
    .filter((job) => {
      const existing = stateById.get(job.id);
      return !existing || existing.inputHash !== computeInputHash(job, profile, github, model);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEW_PACKAGES_PER_RUN);

  console.log("Validated package selection against private review state.");
  if (candidates.length === 0) {
    report.outcome = "no-op";
    return;
  }

  let generated = 0;
  let failed = 0;

  for (const job of candidates) {
    try {
      if (selectedJobId(job.id) !== job.id) throw new Error("Invalid snapshot ID");
      console.log("Preparing private package...");
      const preparation = prepareApplication(profile, github, job);

      report.stage = mode === "ai" ? "provider generation" : "template preparation";
      const raw =
        mode === "template"
          ? preparation
          : await ai!.generate({
              systemPrompt: buildSystemPrompt(),
              userPrompt: buildUserPrompt({ profile, job }),
              profile
            });

      report.stage = "factual validation";
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
      if (mode === "ai") {
        const ids = profile.experience.map((role) => role.id);
        const invalidIds =
          raw.experienceOrder.length !== ids.length || new Set(raw.experienceOrder).size !== ids.length || raw.experienceOrder.some((id) => !ids.includes(id));
        const invalidSelections =
          new Set(raw.highlightSelections.map((item) => item.experienceId)).size !== raw.highlightSelections.length ||
          raw.highlightSelections.some((item) => !ids.includes(item.experienceId));
        if (invalidIds) throw new GroqFailure("AI factual validation failed: experience order must retain every known role once");
        if (invalidSelections) throw new GroqFailure("AI factual validation failed: unsupported or duplicate role selections");
        if (sanitized.warnings.length) throw new GroqFailure("AI factual validation failed: invalid category order or profile highlights");
      }
      report.stage = "PDF compilation";

      const jobBuildDirRelative = `${buildDirRelative}/${job.id}`;
      await mkdir(resolve(jobBuildDirRelative), { recursive: true });
      const sourceDateEpoch = Math.floor(Date.now() / 1000);

      const cvTexRelative = `${jobBuildDirRelative}/cv.tex`;
      await writeFile(resolve(cvTexRelative), renderResumeLatex(profile, github, sanitized), "utf8");
      const cvPdfPath = await compileLatexToPdf(cvTexRelative, jobBuildDirRelative, sourceDateEpoch, { quiet: true });

      const coverLetterTexRelative = `${jobBuildDirRelative}/cover-letter.tex`;
      await writeFile(
        resolve(coverLetterTexRelative),
        renderCoverLetterLatex(profile, { title: job.title, company: job.company }, raw.coverLetterBody, new Date()),
        "utf8"
      );
      const coverLetterPdfPath = await compileLatexToPdf(coverLetterTexRelative, jobBuildDirRelative, sourceDateEpoch, { quiet: true });

      report.stage = "private package staging";
      const targetDir = resolve(repoDir, job.id);
      await mkdir(targetDir, { recursive: true });
      await copyFile(cvPdfPath, resolve(targetDir, "cv.pdf"));
      await copyFile(coverLetterPdfPath, resolve(targetDir, "cover-letter.pdf"));

      await writeFile(resolve(targetDir, "preparation.md"), preparation.markdown, "utf8");
      const generatedAt = new Date().toISOString();
      await writeFile(
        resolve(targetDir, "summary.md"),
        buildSummaryMarkdown({ job, warnings: [...sanitized.warnings, ...sanitized.reviewFlags], flaggedTerms, model, generatedAt }),
        "utf8"
      );

      stateById.set(job.id, {
        opportunityId: job.id,
        inputHash: computeInputHash(job, profile, github, model),
        generatedAt,
        model,
        status: "pending",
        respondedAt: null
      });
      generated++;
    } catch (error) {
      if (error instanceof GroqFailure) report.diagnostic = error.message;
      failed++;
      console.error("Package preparation failed; no private changes will be published.");
      break;
    } finally {
      if (/^[a-f0-9]{20}$/.test(job.id)) await rm(resolve(buildDirRelative, job.id), { recursive: true, force: true });
    }
  }

  if (failed > 0) throw new Error("One or more packages failed; no private changes were published. Retry after correcting the failure.");
  const nextState: ApplicationState = { schemaVersion: 1, entries: [...stateById.values()] };
  report.stage = "private publication";
  await writeState(repoDir, nextState);

  const pushed = await commitAndPush(repoDir, deployKey, `Generate ${generated} tailored application package(s)`);
  if (!pushed) throw new Error("Private publication produced no changes despite generated packages");
  report.outcome = "published";
  console.log("Validated private packages published. Review drafts before sending.");
}

export async function generateApplications() {
  const report: RunReport = { mode: process.env.APPLICATIONS_MODE || "template", stage: "configuration", outcome: "failed", providerAccess: false };
  try {
    await generateApplicationsInternal(report);
  } catch (error) {
    if (error instanceof GroqFailure) report.diagnostic = error.message;
    throw error;
  } finally {
    try {
      if (process.env.GITHUB_STEP_SUMMARY) {
        const mode = report.mode === "ai" || report.mode === "template" ? report.mode : "invalid";
        const lines = [
          "## Application preparation",
          "",
          `- Mode: ${mode}`,
          `- Outcome: ${report.outcome}`,
          `- Stage: ${report.stage}`,
          `- Groq access probe: ${report.providerAccess ? "passed (inference access and current quota only; not a billing or full-package guarantee)" : "not verified"}`,
          "- Private package contents, job identifiers and review counts are omitted."
        ];
        if (report.diagnostic) lines.push(`- Diagnostic: ${report.diagnostic}`);
        if (report.metrics)
          lines.push(
            `- Provider requests: ${report.metrics.requests}; reported input/output tokens: ${report.metrics.inputTokens}/${report.metrics.outputTokens}`
          );
        await writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
      }
    } finally {
      await rm(resolve(buildDirRelative), { recursive: true, force: true });
      await rm(resolve(".applications-private"), { recursive: true, force: true });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateApplications().catch(() => {
    console.error("Application generation failed. Check configuration and validated snapshots; private drafts were not logged.");
    process.exitCode = 1;
  });
}

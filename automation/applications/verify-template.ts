import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseProfessionalProfile } from "../../src/features/profile/profile-schema";
import { githubSnapshotSchema } from "../../src/features/github/github-model";
import { opportunitySnapshotSchema } from "../../src/features/jobs/opportunities";
import { prepareApplication } from "../../src/features/applications/template";
import { validateCvTailoringPlan } from "../../src/features/cv/tailoring";
import { renderResumeLatex } from "../../src/features/cv/latex";
import { renderCoverLetterLatex } from "../../src/features/applications/cover-letter-latex";
import { compileLatexToPdf } from "../cv/build";
import { verifyCv } from "../cv/verify";

// Public verified facts + a synthetic posting; no deploy key, API key or private publisher.
const dir = ".applications-build/ci-template";
try {
  const profile = parseProfessionalProfile(JSON.parse(await readFile("data/profile.generated.json", "utf8")));
  const github = githubSnapshotSchema.parse(JSON.parse(await readFile("data/github.generated.json", "utf8")));
  const jobs = opportunitySnapshotSchema.parse(JSON.parse(await readFile("data/jobs.generated.json", "utf8")));
  const source = jobs.opportunities[0];
  if (!source) throw new Error("A snapshot fixture is required");
  const job = {
    ...source,
    title: "Template validation role",
    company: "Example Company",
    eligibility: "eligible" as const,
    status: "active" as const,
    tags: ["Laravel"],
    descriptionText: "Laravel engineering"
  };
  const preparation = prepareApplication(profile, github, job);
  const plan = validateCvTailoringPlan(
    { ...preparation, highlightSelections: Object.fromEntries(preparation.highlightSelections.map((entry) => [entry.experienceId, entry.highlights])) },
    profile
  );
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/cv.tex`, renderResumeLatex(profile, github, plan));
  await writeFile(`${dir}/cover-letter.tex`, renderCoverLetterLatex(profile, job, preparation.coverLetterBody, new Date("2026-01-01T00:00:00Z")));
  const epoch = Math.floor(new Date(profile.modifiedAt).getTime() / 1000);
  const cv = await compileLatexToPdf(`${dir}/cv.tex`, dir, epoch, { quiet: true });
  await verifyCv(cv);
  await compileLatexToPdf(`${dir}/cover-letter.tex`, dir, epoch, { quiet: true });
  console.log("Verified template CV and cover-letter PDF compilation; temporary outputs removed.");
} finally {
  await rm(resolve(dir), { recursive: true, force: true });
}

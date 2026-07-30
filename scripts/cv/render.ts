import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { githubSnapshotSchema } from "../../lib/github-model";
import { renderResumeLatex } from "../../lib/latex";
import { parseProfessionalProfile } from "../../lib/profile-schema";

export async function renderCvSource() {
  const outputDirectory = resolve("cv/generated");
  const output = resolve(outputDirectory, "Jerome-Resume.tex");
  const profileData = JSON.parse(await readFile(resolve("data/profile.generated.json"), "utf8"));
  const githubData = JSON.parse(await readFile(resolve("data/github.generated.json"), "utf8"));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    output,
    renderResumeLatex(parseProfessionalProfile(profileData), githubSnapshotSchema.parse(githubData)),
    "utf8"
  );
  return output;
}

async function main() {
  console.log(`Rendered ${await renderCvSource()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

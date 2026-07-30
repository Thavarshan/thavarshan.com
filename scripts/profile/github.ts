import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchGitHubSnapshot } from "../../lib/github";
import { findProfileConflicts } from "../../lib/profile-conflicts";
import { parseProfessionalProfile } from "../../lib/profile-schema";
import { writeJsonAtomic } from "./io";

export async function syncGitHubProfile() {
  const snapshot = await fetchGitHubSnapshot({ token: process.env.GITHUB_TOKEN });
  const output = resolve("data/github.generated.json");
  await writeJsonAtomic(output, snapshot);

  return {
    snapshot,
    output,
    warnings: findProfileConflicts(
      parseProfessionalProfile(JSON.parse(await readFile(resolve("data/profile.generated.json"), "utf8"))),
      snapshot
    )
  };
}

async function main() {
  const result = await syncGitHubProfile();
  console.log(`Updated ${result.output} with ${result.snapshot.projects.length} featured repositories`);
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

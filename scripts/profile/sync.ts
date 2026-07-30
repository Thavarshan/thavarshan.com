import { resolve } from "node:path";
import { importProfileArchive } from "./import";
import { syncGitHubProfile } from "./github";
import { buildCv } from "../cv/build";
import { verifyCv } from "../cv/verify";

async function main() {
  const archivePath = process.argv[2];
  if (!archivePath) {
    throw new Error("Usage: npm run profile:sync -- /absolute/path/to/linkedin-export.zip");
  }

  const imported = await importProfileArchive(resolve(archivePath));
  const github = await syncGitHubProfile();
  const cv = await buildCv();
  const verification = await verifyCv(cv);

  console.log(`Imported LinkedIn sections: ${imported.importedSections.join(", ")}`);
  console.log(`Synced ${github.snapshot.projects.length} GitHub projects`);
  console.log(`Built and verified ${verification.pages}-page CV at ${cv}`);
  for (const warning of [...imported.warnings, ...github.warnings]) {
    console.warn(`Warning: ${warning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

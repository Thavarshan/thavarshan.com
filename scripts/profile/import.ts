import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import currentProfileData from "../../data/profile.generated.json";
import { importLinkedInArchive } from "../../lib/linkedin-archive";
import { parseProfessionalProfile } from "../../lib/profile-schema";
import { writeJsonAtomic } from "./io";

export async function importProfileArchive(archivePath: string) {
  const resolvedArchive = resolve(archivePath);
  const archive = await readFile(resolvedArchive);
  const result = importLinkedInArchive(archive, parseProfessionalProfile(currentProfileData));
  const output = resolve("data/profile.generated.json");
  await writeJsonAtomic(output, result.profile);

  return { ...result, output };
}

async function main() {
  const archivePath = process.argv[2];
  if (!archivePath) {
    throw new Error("Usage: npm run profile:import -- /absolute/path/to/linkedin-export.zip");
  }

  const result = await importProfileArchive(archivePath);
  console.log(`Updated ${result.output}`);
  console.log(`Imported: ${result.importedSections.join(", ")}`);
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

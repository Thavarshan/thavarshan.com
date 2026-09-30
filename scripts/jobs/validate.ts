import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadSnapshot, CURRENT_SCHEMA_VERSION } from "../../lib/job-snapshot";

/** Fails (exit 1) unless the committed snapshot is valid at the current schema version, so a bad bot commit is caught in CI. */
async function main() {
  const path = resolve(process.argv[2] ?? "data/jobs.generated.json");
  const { snapshot, migratedFrom } = loadSnapshot(JSON.parse(await readFile(path, "utf8")));
  if (migratedFrom !== null) {
    throw new Error(`${path} is schemaVersion ${migratedFrom}; commit the migrated snapshot (current is ${CURRENT_SCHEMA_VERSION}).`);
  }
  const ids = new Set(snapshot.opportunities.map((item) => item.id));
  if (ids.size !== snapshot.opportunities.length) throw new Error(`${path} contains duplicate opportunity ids`);
  console.log(`${path}: valid schemaVersion ${snapshot.schemaVersion}, ${snapshot.opportunities.length} opportunities.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

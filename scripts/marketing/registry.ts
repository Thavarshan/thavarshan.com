import { resolve } from "node:path";
import { packageRegistrySnapshot } from "../../lib/package-registry";
import { writeJsonAtomic } from "../profile/io";

type PackagistResponse = {
  package?: {
    name: string;
    downloads?: { total?: number };
    dependents?: number;
    versions?: Record<string, { version: string; time?: string }>;
  };
};

function normalizeDate(value: string | undefined) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

async function fetchPackagist(packageName: string) {
  const response = await fetch(`https://packagist.org/packages/${packageName}.json`);
  if (!response.ok) {
    throw new Error(`Packagist request failed with ${response.status} for ${packageName}`);
  }

  const payload = (await response.json()) as PackagistResponse;
  const versions = Object.values(payload.package?.versions ?? {}).filter((item) => !item.version.includes("dev"));
  const latest = versions[0];

  return {
    downloads: payload.package?.downloads?.total,
    dependents: payload.package?.dependents,
    latestVersion: latest?.version,
    updatedAt: normalizeDate(latest?.time)
  };
}

async function main() {
  const refreshed = [];

  for (const item of packageRegistrySnapshot.packages) {
    if (item.provider !== "packagist") {
      refreshed.push(item);
      continue;
    }

    const latest = await fetchPackagist(item.packageName);
    refreshed.push({
      ...item,
      ...latest
    });
  }

  const output = resolve("data/package-registry.generated.json");
  await writeJsonAtomic(output, {
    syncedAt: new Date().toISOString(),
    packages: refreshed
  });
  console.log(`Updated ${output} with ${refreshed.length} package records`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

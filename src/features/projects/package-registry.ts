import registryData from "@generated/package-registry.generated.json";
import { packageRegistrySnapshotSchema, type PackageRegistryStats } from "./package-registry-model";
export * from "./package-registry-model";

export const packageRegistrySnapshot = packageRegistrySnapshotSchema.parse(registryData);

export function getPackageStatsByRepository(repository: string): PackageRegistryStats | undefined {
  const match = packageRegistrySnapshot.packages.find((item) => item.repository === repository);

  if (!match) {
    return undefined;
  }

  return {
    provider: match.provider,
    packageName: match.packageName,
    downloads: match.downloads,
    dependents: match.dependents,
    latestVersion: match.latestVersion,
    updatedAt: match.updatedAt
  };
}

export function formatPackageProvider(provider: PackageRegistryStats["provider"]) {
  const labels: Record<PackageRegistryStats["provider"], string> = {
    crates: "crates.io",
    npm: "npm",
    packagist: "Packagist"
  };

  return labels[provider];
}

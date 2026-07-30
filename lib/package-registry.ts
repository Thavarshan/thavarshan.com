import registryData from "@/data/package-registry.generated.json";
import { z } from "zod";

export const packageRegistryStatsSchema = z.object({
  provider: z.enum(["packagist", "npm", "crates"]),
  packageName: z.string().min(1),
  downloads: z.number().int().nonnegative().optional(),
  dependents: z.number().int().nonnegative().optional(),
  latestVersion: z.string().min(1).optional(),
  updatedAt: z.string().datetime()
});

export const packageRegistrySnapshotSchema = z.object({
  syncedAt: z.string().datetime(),
  packages: z.array(
    packageRegistryStatsSchema.extend({
      repository: z.string().min(1)
    })
  )
});

export type PackageRegistryStats = z.infer<typeof packageRegistryStatsSchema>;
export type PackageRegistrySnapshot = z.infer<typeof packageRegistrySnapshotSchema>;

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

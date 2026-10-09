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

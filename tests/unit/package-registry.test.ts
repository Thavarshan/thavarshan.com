import { describe, expect, it } from "vitest";
import { formatPackageProvider, getPackageStatsByRepository, packageRegistrySnapshot } from "@/lib/package-registry";

describe("package registry snapshot", () => {
  it("returns deterministic fallback package stats by repository", () => {
    const stats = getPackageStatsByRepository("fetch-php");

    expect(stats?.provider).toBe("packagist");
    expect(stats?.packageName).toBe("jerome/fetch-php");
    expect(stats?.downloads).toBeGreaterThan(0);
  });

  it("keeps the package snapshot valid and readable", () => {
    expect(packageRegistrySnapshot.packages.length).toBeGreaterThanOrEqual(3);
    expect(formatPackageProvider("packagist")).toBe("Packagist");
    expect(getPackageStatsByRepository("unknown")).toBeUndefined();
  });
});

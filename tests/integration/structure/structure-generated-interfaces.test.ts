// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Generated files are INTERFACES: workflows commit them, scripts write them, the site builds from them,
 * and one Worker fetches `data/jobs.generated.json` by its exact raw GitHub URL. Moving one is a
 * coordinated migration, never a side effect of reorganising code. This table records each path and the
 * files that must keep referring to it; a move that strands a consumer fails here.
 * When a consumer file itself moves, update its path in the same PR.
 */
const interfaces: Array<{ path: string; why: string; consumers: string[] }> = [
  {
    path: "data/jobs.generated.json",
    why: "daily jobs snapshot; fetched by the job-review Worker",
    consumers: [".github/workflows/jobs-refresh.yml", "automation/jobs/collect.ts", "automation/applications/generate.ts", "workers/job-review/wrangler.toml"]
  },
  {
    path: "data/profile.generated.json",
    why: "validated professional profile (website + CV)",
    consumers: [".github/workflows/content-refresh.yml", "automation/cv/render.ts", "automation/profile/publish.ts"]
  },
  {
    path: "data/github.generated.json",
    why: "repository snapshot",
    consumers: [".github/workflows/content-refresh.yml", "automation/profile/github.ts", "src/app/sitemap.ts"]
  },
  {
    path: "data/package-registry.generated.json",
    why: "package registry snapshot",
    consumers: [".github/workflows/content-refresh.yml", "automation/marketing/registry.ts", "src/features/projects/package-registry.ts"]
  },
  { path: "data/growth", why: "weekly growth metrics snapshots", consumers: [".github/workflows/growth-metrics.yml", "automation/growth/metrics-snapshot.ts"] },
  {
    path: "marketing/oss-ledger.json",
    why: "OSS bundle dedupe ledger",
    consumers: [".github/workflows/oss-bundles.yml", "automation/marketing/oss-bundles.ts"]
  },
  { path: "marketing/oss", why: "OSS promotion drafts", consumers: [".github/workflows/oss-bundles.yml", "automation/marketing/oss-bundles.ts"] },
  { path: "marketing/generated", why: "Insight distribution bundles", consumers: ["automation/marketing/distribution.ts"] },
  {
    path: "public/docs/Jerome-Resume.pdf",
    why: "the stable public CV URL",
    consumers: [".github/workflows/content-refresh.yml", "automation/cv/publish.ts", "automation/profile/publish.ts"]
  },
  { path: "cv/generated", why: "rendered LaTeX", consumers: [".github/workflows/content-refresh.yml", "automation/cv/render.ts", "automation/cv/build.ts"] }
];

// Paths that are not in a clean checkout: created by a workflow's first run, or gitignored build output
// (marketing/generated is written by `npm run insights:bundle` and listed in .gitignore).
const createdOnFirstRun = new Set(["marketing/oss", "data/growth", "marketing/generated"]);

describe("generated paths are stable interfaces", () => {
  it.each(interfaces)("$path ($why) exists and is still referenced by every consumer", ({ path, consumers }) => {
    if (!createdOnFirstRun.has(path)) expect(existsSync(path), `${path} must exist`).toBe(true);
    // Code imports the generated JSON through the "@generated/" alias (which maps to data/); other files use the literal path.
    const spellings = [path, path.replace(/^data\//, "@generated/")];
    for (const consumer of consumers) {
      expect(existsSync(consumer), `consumer ${consumer} must exist (did it move?)`).toBe(true);
      const source = readFileSync(consumer, "utf8");
      expect(
        spellings.some((spelling) => source.includes(spelling)),
        `${consumer} must reference ${path}`
      ).toBe(true);
    }
  });

  it("the job-review Worker still fetches the exact raw GitHub path of the jobs snapshot", () => {
    const wrangler = readFileSync("workers/job-review/wrangler.toml", "utf8");
    expect(wrangler).toContain('JOBS_DATA_URL = "https://raw.githubusercontent.com/Thavarshan/thavarshan.com/main/data/jobs.generated.json"');
  });

  it("the site-metrics Worker's namespace binding and the snapshot job agree on its config location", () => {
    expect(readFileSync("automation/growth/metrics-snapshot.ts", "utf8")).toContain("workers/site-metrics/wrangler.toml");
    expect(existsSync("workers/site-metrics/wrangler.toml")).toBe(true);
  });

  it("the stable CV URL, the fallback and the page that links them all exist together", () => {
    expect(existsSync("public/docs/Jerome-Resume.pdf")).toBe(true);
    expect(existsSync("public/docs/Jerome-Resume-fallback.pdf")).toBe(true);
  });
});

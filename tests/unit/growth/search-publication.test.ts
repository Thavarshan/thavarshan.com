// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedPrivateJson, prepareSearchFeedback, readContentPriorities } from "../../../automation/growth/search/run";
import type { SearchSnapshot } from "../../../automation/growth/search/model";

const now = new Date("2026-10-11T12:00:00Z");
const input = (): SearchSnapshot => ({
  schemaVersion: 1,
  source: "google",
  property: "https://thavarshan.com/",
  collectedAt: now.toISOString(),
  searchType: "web",
  filters: { country: "all", device: "all" },
  timezone: "America/Los_Angeles",
  coverage: "partial-top-rows",
  current: { start: "2026-09-11", end: "2026-10-08", totals: { clicks: 1, impressions: 100, position: 10 }, pages: [], queries: [] },
  previous: { start: "2026-08-14", end: "2026-09-10", totals: null, pages: [], queries: [] }
});
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "search-feedback-test-"));
  directories.push(directory);
  const root = join(directory, "search-performance");
  await mkdir(root);
  const clone = vi.fn(async () => directory);
  const commit = vi.fn(async () => true);
  const collect = vi.fn(async () => input());
  return {
    root,
    options: {
      env: {
        GITHUB_REF: "refs/heads/main",
        APPLICATIONS_REPO_DEPLOY_KEY: "KEY_SENTINEL",
        GOOGLE_SEARCH_CONSOLE_CREDENTIALS: "GOOGLE_SENTINEL",
        GOOGLE_SEARCH_CONSOLE_PROPERTY: ""
      },
      now,
      knownPaths: new Set(["/"]),
      clone,
      commit,
      collect
    }
  };
}
describe("private search publication", () => {
  it("publishes private outputs and returns only the fixed public status", async () => {
    const { root, options } = await setup();
    const status = await prepareSearchFeedback(options);
    expect(status).toEqual({ schemaVersion: 1, status: "available" });
    expect(options.commit).toHaveBeenCalledTimes(1);
    expect(options.collect).toHaveBeenCalledWith("GOOGLE_SENTINEL", undefined, now);
    const plan = JSON.parse(await readFile(join(root, "google-content-plan.json"), "utf8"));
    expect(plan.requiresHumanReview).toBe(true);
    for (const name of ["google.json", "google-report.json", "google-content-plan.json", "google-summary.md"])
      expect(await readFile(join(root, name), "utf8")).not.toMatch(/KEY_SENTINEL|GOOGLE_SENTINEL/);
  });
  it("rejects non-main execution before accessing private credentials", async () => {
    const { options } = await setup();
    options.env.GITHUB_REF = "refs/pull/1/merge";
    await expect(prepareSearchFeedback(options)).rejects.toThrow("trusted main");
    expect(options.clone).not.toHaveBeenCalled();
  });
  it("labels unconfigured data unavailable and fails when configured collection cannot publish", async () => {
    const { options } = await setup();
    expect(await prepareSearchFeedback({ ...options, env: { GITHUB_REF: "refs/heads/main" } })).toEqual({ schemaVersion: 1, status: "unavailable" });
    await expect(
      prepareSearchFeedback({ ...options, env: { GITHUB_REF: "refs/heads/main", GOOGLE_SEARCH_CONSOLE_CREDENTIALS: "GOOGLE_SENTINEL" } })
    ).rejects.toThrow("not configured");
    expect(options.clone).not.toHaveBeenCalled();
  });
  it("validates all inputs before replacing last-known-good files", async () => {
    const { root, options } = await setup();
    await writeFile(join(root, "google-report.json"), "LAST_GOOD");
    await writeFile(join(root, "bing.json"), '{"invalid":true}');
    await expect(prepareSearchFeedback(options)).rejects.toThrow();
    expect(options.commit).not.toHaveBeenCalled();
    expect(await readFile(join(root, "google-report.json"), "utf8")).toBe("LAST_GOOD");
  });
  it("preserves reports when the provider fails and never reports failed publication as available", async () => {
    const { root, options } = await setup();
    await writeFile(join(root, "google-report.json"), "LAST_GOOD");
    options.collect.mockRejectedValueOnce(new Error("safe access failure"));
    await expect(prepareSearchFeedback(options)).rejects.toThrow();
    expect(await readFile(join(root, "google-report.json"), "utf8")).toBe("LAST_GOOD");
    expect(options.commit).not.toHaveBeenCalled();
    options.commit.mockRejectedValueOnce(new Error("private push failed"));
    await expect(prepareSearchFeedback(options)).rejects.toThrow("private push failed");
  });
  it("analyzes existing owner exports without Google credentials and makes stale data explicit", async () => {
    const { root, options } = await setup();
    const stale = input();
    stale.collectedAt = "2026-10-11T12:00:00Z";
    await writeFile(join(root, "google.json"), JSON.stringify(stale));
    const result = await prepareSearchFeedback({
      ...options,
      env: { GITHUB_REF: "refs/heads/main", APPLICATIONS_REPO_DEPLOY_KEY: "KEY" },
      now: new Date("2026-11-01T12:00:00Z")
    });
    expect(result.status).toBe("stale");
    expect(options.collect).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(join(root, "google-content-plan.json"), "utf8")).tasks).toEqual([]);
  });
  it("never follows private input or output symlinks", async () => {
    const { root, options } = await setup();
    const target = join(root, "sentinel.json");
    await writeFile(target, "LAST_GOOD");
    await symlink(target, join(root, "google.json"));
    await expect(boundedPrivateJson(join(root, "google.json"))).rejects.toThrow();
    await expect(prepareSearchFeedback(options)).rejects.toThrow();
    expect(options.commit).not.toHaveBeenCalled();
    expect(await readFile(target, "utf8")).toBe("LAST_GOOD");
  });
  it("rejects directory symlinks and oversized local files", async () => {
    const { root, options } = await setup();
    await rm(root, { recursive: true });
    await symlink(tmpdir(), root);
    await expect(prepareSearchFeedback(options)).rejects.toThrow("directory");
    const file = join(directories[0], "large.json");
    await writeFile(file, "x".repeat(2 * 1024 * 1024 + 1));
    await expect(boundedPrivateJson(file)).rejects.toThrow("Invalid private search file");
  });
  it("loads evidence-backed private plans for content refresh without publishing changes", async () => {
    const { root, options } = await setup();
    await writeFile(join(root, "google.json"), JSON.stringify(input()));
    const plans = await readContentPriorities(await options.clone(), new Set(["/"]), now);
    expect(plans).toHaveLength(1);
    expect(plans[0].requiresHumanReview).toBe(true);
    expect(options.commit).not.toHaveBeenCalled();
    expect(await readContentPriorities(await options.clone(), new Set(["/"]), new Date("2026-11-01T12:00:00Z"))).toEqual([]);
  });
});

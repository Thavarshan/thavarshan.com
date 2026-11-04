// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const site = JSON.parse(readFileSync("wrangler.json", "utf8"));
const redirect = JSON.parse(readFileSync("wrangler.redirect.json", "utf8"));
const allowed = (value: object, keys: string[]) => expect(Object.keys(value).filter((key) => !keys.includes(key))).toEqual([]);

describe("static hosting stays on the existing Free-plan products", () => {
  it("allows only static assets, custom domains and an isolated preview override", () => {
    allowed(site, ["$schema", "name", "compatibility_date", "workers_dev", "preview_urls", "routes", "assets", "env"]);
    expect(site.main).toBeUndefined();
    expect(site.routes).toEqual([{ pattern: "thavarshan.com", custom_domain: true }]);
    expect(site.assets).toEqual({ directory: "./out", html_handling: "drop-trailing-slash", not_found_handling: "404-page" });
    expect(Object.keys(site.env)).toEqual(["preview"]);
    allowed(site.env.preview, ["name", "routes", "assets"]);
    expect(site.env.preview.routes).toEqual([]);
    expect(site.env.preview.assets).toEqual(site.assets);
    expect(site.env.preview.name).toBe("thavarshan-site-preview");
  });
  it("allows the www redirect script without storage, paid bindings or runtime flags", () => {
    allowed(redirect, ["$schema", "name", "main", "compatibility_date", "workers_dev", "preview_urls", "routes"]);
    expect(redirect.main).toBe("workers/site-redirect/index.ts");
    expect(redirect.routes).toEqual([{ pattern: "www.thavarshan.com", custom_domain: true }]);
    expect(redirect.workers_dev).toBe(false);
  });
  it("keeps preview deploys on trusted code and cleanup restricted to a numbered preview", () => {
    const workflow = readFileSync(".github/workflows/deployment-smoke.yml", "utf8");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain('if [ "$head_repo" != "$GITHUB_REPOSITORY" ]');
    expect(workflow).toContain("--env preview --name");
    expect(workflow).not.toContain("pull_request_target");
    const cleanup = readFileSync(".github/workflows/site-preview-cleanup.yml", "utf8");
    expect(cleanup).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(cleanup).toContain('--env preview --name "thavarshan-site-pr-$PR_NUMBER"');
  });
});

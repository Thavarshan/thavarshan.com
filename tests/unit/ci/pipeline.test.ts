// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildMetadata, deploymentHeaders } from "../../../automation/ci/build-metadata";
import { checkHeaders, checkHtml, checkRedirect, deploymentOrigin, revisionMatches } from "../../../automation/ci/deployment-rules";
import { unpinnedActions } from "../../../automation/ci/workflow-pins";

const revision = "a".repeat(40);
const url = "https://thavarshan.com/projects";
function headers() {
  return new Headers({
    "content-type": "text/html",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": "object-src 'none'",
    "strict-transport-security": "max-age=31536000",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=()"
  });
}

describe("deployment boundaries", () => {
  it("only permits HTTPS origins for this site and its previews", () => {
    expect(deploymentOrigin("https://thavarshan.com", "production")).toBe("https://thavarshan.com");
    expect(deploymentOrigin("https://deploy-preview-106--thavarshan.netlify.app", "preview")).toContain("deploy-preview-106");
    for (const input of [
      "http://thavarshan.com",
      "https://thavarshan.com/path",
      "https://user@thavarshan.com",
      "https://evil.netlify.app",
      "https://thavarshan.com.evil.test",
      "https://main--thavarshan.netlify.app:443/?x=1",
      "http://127.0.0.1"
    ])
      expect(() => deploymentOrigin(input, "preview")).toThrow();
  });
  it("rejects stale revisions, malformed markers and incorrect deployment contexts", () => {
    expect(revisionMatches(buildMetadata(revision, "production"), revision, "production")).toBe(true);
    for (const marker of [
      null,
      {},
      { ...buildMetadata(revision, "production"), schemaVersion: 2 },
      buildMetadata("b".repeat(40), "production"),
      buildMetadata(revision, "branch-deploy")
    ])
      expect(revisionMatches(marker, revision, "production")).toBe(false);
    expect(revisionMatches(buildMetadata(revision, "deploy-preview"), revision, "preview")).toBe(true);
    expect(() => buildMetadata("short", "production")).toThrow();
  });
  it("blocks preview and branch indexing without blocking production HTML", () => {
    for (const context of ["deploy-preview", "branch-deploy"]) expect(deploymentHeaders(context)).toContain("/*\n  X-Robots-Tag: noindex, nofollow");
    expect(deploymentHeaders("production")).not.toContain("/*");
    expect(deploymentHeaders("production")).toContain("Cache-Control: no-store");
  });
  it("rejects missing security headers, redirects, server errors and production noindex", () => {
    expect(checkHeaders(url, 200, headers(), "production")).toEqual([]);
    expect(checkHeaders(url, 200, new Headers(), "production").length).toBeGreaterThan(5);
    for (const status of [301, 500])
      expect(checkHeaders(url, status, headers(), "production")).toContainEqual(expect.objectContaining({ rule: "http-status" }));
    const noindex = headers();
    noindex.set("x-robots-tag", "noindex");
    expect(checkHeaders(url, 200, noindex, "production")).toContainEqual(expect.objectContaining({ rule: "indexability" }));
    expect(checkHeaders(url, 200, noindex, "preview")).toEqual([]);
    expect(checkHeaders(url, 200, headers(), "preview")).toContainEqual(expect.objectContaining({ rule: "indexability" }));
    expect(checkHeaders(url, 404, headers(), "production", "missing")).toEqual([]);
  });
  it("requires the published PDF to remain unindexed and have a PDF content type", () => {
    const pdf = headers();
    pdf.set("content-type", "application/pdf");
    pdf.set("x-robots-tag", "noindex, nofollow");
    expect(checkHeaders(url, 200, pdf, "production", "pdf")).toEqual([]);
    expect(checkHeaders(url, 200, headers(), "production", "pdf").map((f) => f.rule)).toEqual(["indexability", "content-type"]);
  });
  it("rejects temporary, missing, malformed and off-origin redirects", () => {
    expect(checkRedirect(url + "/", 301, "/projects", url)).toEqual([]);
    expect(checkRedirect(url + "/", 308, url, url)).toEqual([]);
    for (const [status, location] of [
      [302, url],
      [301, null],
      [301, "https://elsewhere.test/projects"],
      [301, "https://["]
    ] as const)
      expect(checkRedirect(url + "/", status, location, url)).toHaveLength(1);
  });
  it("requires production canonicals even on previews", () => {
    expect(checkHtml(url, `<link rel="canonical" href="${url}"/>`, "production")).toEqual([]);
    expect(checkHtml("https://deploy-preview-106--thavarshan.netlify.app/projects", `<link rel="canonical" href="${url}"/>`, "preview")).toEqual([]);
    expect(checkHtml(url, '<link rel="canonical" href="https://elsewhere.com/projects"/>', "production")).toContainEqual(
      expect.objectContaining({ rule: "canonical" })
    );
    expect(checkHtml(url, `<link rel="canonical" href="${url}"/><meta name="robots" content="noindex"/>`, "production")).toContainEqual(
      expect.objectContaining({ rule: "indexability" })
    );
  });
});

describe("CI enforcement", () => {
  const successful = Object.fromEntries(["quality", "browser", "seo", "cv", "lighthouse", "security"].map((job) => [job, { result: "success" }]));
  const gate = (results: unknown) =>
    execFileSync(process.execPath, ["automation/ci/gate.mjs"], { env: { ...process.env, JOB_RESULTS: JSON.stringify(results) }, stdio: "pipe" });
  it("allows only a completely successful mandatory job set", () => {
    expect(() => gate(successful)).not.toThrow();
    for (const result of ["failure", "skipped", "cancelled", undefined]) expect(() => gate({ ...successful, security: { result } })).toThrow();
    expect(() => gate({})).toThrow();
  });
  it("detects mutable tags, docker tags and missing action revisions", () => {
    expect(unpinnedActions(`- uses: actions/checkout@${revision} # version\n- uses: ./local`)).toEqual([]);
    expect(unpinnedActions("- uses: actions/checkout@v4\n- uses: docker://tool:latest\n- uses: actions/setup-node")).toHaveLength(3);
  });
});

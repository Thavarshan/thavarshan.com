// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const success = Object.fromEntries(["quality", "browser", "seo", "cv", "lighthouse", "security"].map((job) => [job, { result: "success" }]));
const fixture = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: "Thavarshan/thavarshan.com",
  GITHUB_SHA: "a".repeat(40),
  GITHUB_RUN_ID: "123",
  GITHUB_TOKEN: "PRIVATE_FIXTURE_TOKEN",
  GATE_RESULT: "success",
  JOB_RESULTS: JSON.stringify(success)
};
function publish(overrides = {}) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
    import { publishGateStatus } from './automation/ci/gate-status.mjs';
    let request;
    try {
      const state = await publishGateStatus(JSON.parse(process.env.GATE_FIXTURE), async (url, options) => {
        request = {url, method: options.method, redirect: options.redirect, body: JSON.parse(options.body)};
        return new Response(null, {status: 201});
      });
      console.log(JSON.stringify({state, request}));
    } catch (error) { console.log(JSON.stringify({error: error.message, requested: !!request})); }
  `
      ],
      { encoding: "utf8", env: { ...process.env, GATE_FIXTURE: JSON.stringify({ ...fixture, ...overrides }) } }
    )
  );
}

describe("dispatched CI commit gate status", () => {
  it("records genuine success on the exact revision with the verified run link", () => {
    expect(publish()).toEqual({
      state: "success",
      request: {
        url: `https://api.github.com/repos/Thavarshan/thavarshan.com/statuses/${fixture.GITHUB_SHA}`,
        method: "POST",
        redirect: "manual",
        body: {
          context: "ci-gate",
          state: "success",
          target_url: "https://github.com/Thavarshan/thavarshan.com/actions/runs/123",
          description: "All mandatory CI jobs passed on this revision"
        }
      }
    });
  });
  it("never attests success for failed, skipped, cancelled or missing mandatory work", () => {
    for (const result of ["failure", "skipped", "cancelled", undefined])
      expect(publish({ JOB_RESULTS: JSON.stringify({ ...success, quality: { result } }) }).state).toBe("failure");
    expect(publish({ JOB_RESULTS: "{}" }).state).toBe("failure");
    expect(publish({ GATE_RESULT: "failure" }).state).toBe("failure");
  });
  it("refuses unsupported events, repositories and missing provenance before requesting", () => {
    for (const overrides of [
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_REPOSITORY: "other/repo" },
      { GITHUB_SHA: "main" },
      { GITHUB_RUN_ID: "0" },
      { GITHUB_TOKEN: "" }
    ])
      expect(publish(overrides)).toMatchObject({ requested: false });
  });
  it("fails status publication without exposing credentials or API error bodies", () => {
    const preload = 'globalThis.fetch = async () => new Response("PRIVATE_API_ERROR", {status: 403});';
    const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, "automation/ci/gate-status.mjs"], {
      encoding: "utf8",
      env: { ...process.env, ...fixture }
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("status publication failed");
    expect(result.stdout + result.stderr).not.toMatch(/PRIVATE_FIXTURE_TOKEN|PRIVATE_API_ERROR/);
  });
});

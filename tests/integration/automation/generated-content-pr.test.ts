// @vitest-environment node
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("automation/ci/publish-generated.sh");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "generated-content-pr-"));
  const cwd = join(root, "checkout");
  const remote = join(root, "remote.git");
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  execFileSync("git", ["init", "--bare", remote], { stdio: "pipe" });
  execFileSync("git", ["init", "-b", "main", cwd], { stdio: "pipe" });
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  writeFileSync(join(cwd, "data.json"), '{"value":1}\n');
  git("add", "data.json");
  git("commit", "-m", "baseline");
  git("remote", "add", "origin", remote);
  git("push", "origin", "main");
  const baseline = git("rev-parse", "HEAD");
  const gh = join(root, "gh");
  writeFileSync(gh, '#!/usr/bin/env bash\nset -eu\nprintf "%s\\n" "$*" >> "$GH_LOG"\nif [ "$1 $2" = "pr list" ]; then echo "$GH_PENDING"; fi\n');
  chmodSync(gh, 0o755);
  writeFileSync(join(cwd, "data.json"), '{"value":2}\n');
  writeFileSync(join(cwd, "unrelated.txt"), "not generated\n");
  const log = join(root, "gh.log");
  const run = (pending = "0", ref = "refs/heads/main") =>
    execFileSync("bash", [script, "jobs", "Refresh fixture content", "data.json"], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        GH_LOG: log,
        GH_PENDING: pending,
        GITHUB_REF: ref,
        GITHUB_RUN_ID: "123",
        GITHUB_RUN_ATTEMPT: "1"
      }
    });
  return { git, run, log, baseline, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("generated content publication", () => {
  it("pushes only the generated file to a new branch, opens a PR and dispatches required CI", () => {
    const f = fixture();
    try {
      f.run();
      expect(f.git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(f.baseline);
      expect(f.git("ls-remote", "origin", "refs/heads/automation/generated-jobs-123-1")).not.toBe("");
      expect(f.git("show", "--pretty=format:", "--name-only", "HEAD")).toBe("data.json");
      const log = readFileSync(f.log, "utf8");
      expect(log).toContain("pr create --base main --head automation/generated-jobs-123-1");
      expect(log).toContain("workflow run ci.yml --ref automation/generated-jobs-123-1");
    } finally {
      f.cleanup();
    }
  });
  it("does not accumulate another PR while one awaits review", () => {
    const f = fixture();
    try {
      expect(f.run("1")).toContain("already awaiting review");
      expect(f.git("rev-parse", "HEAD")).toBe(f.baseline);
      expect(readFileSync(f.log, "utf8")).not.toContain("pr create");
    } finally {
      f.cleanup();
    }
  });
  it("refuses publication from a non-main workflow", () => {
    const f = fixture();
    try {
      expect(() => f.run("0", "refs/heads/untrusted")).toThrow();
      expect(f.git("rev-parse", "HEAD")).toBe(f.baseline);
    } finally {
      f.cleanup();
    }
  });
});

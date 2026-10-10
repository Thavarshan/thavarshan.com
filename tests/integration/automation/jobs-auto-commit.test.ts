// @vitest-environment node
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("automation/ci/commit-jobs.sh");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "jobs-auto-commit-"));
  const cwd = join(root, "checkout");
  const remote = join(root, "remote.git");
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  execFileSync("git", ["init", "--bare", remote], { stdio: "pipe" });
  execFileSync("git", ["init", "-b", "main", cwd], { stdio: "pipe" });
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  mkdirSync(join(cwd, "data"));
  writeFileSync(join(cwd, "data/jobs.generated.json"), '{"value":1}\n');
  git("add", "data/jobs.generated.json");
  git("commit", "-m", "baseline");
  git("remote", "add", "origin", remote);
  git("push", "origin", "main");
  const baseline = git("rev-parse", "HEAD");
  const gh = join(root, "gh");
  writeFileSync(gh, '#!/usr/bin/env bash\nset -eu\nprintf "%s\\n" "$*" >> "$GH_LOG"\nif [ "$1 $2" = "pr list" ]; then echo "$GH_PENDING"; fi\n');
  chmodSync(gh, 0o755);
  writeFileSync(join(cwd, "data/jobs.generated.json"), '{"value":2}\n');
  writeFileSync(join(cwd, "unrelated.txt"), "not generated\n");
  const log = join(root, "gh.log");
  const run = (pending = "0", ref = "refs/heads/main") =>
    execFileSync("bash", [script], {
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

describe("automatic job snapshot publication", () => {
  it("commits only the snapshot to main and dispatches CI without opening a PR", () => {
    const f = fixture();
    try {
      f.run();
      const head = f.git("rev-parse", "HEAD");
      expect(head).not.toBe(f.baseline);
      expect(f.git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(head);
      expect(f.git("show", "--pretty=format:", "--name-only", "HEAD")).toBe("data/jobs.generated.json");
      const log = readFileSync(f.log, "utf8");
      expect(log).toContain("workflow run ci.yml --ref main");
      expect(log).not.toContain("pr ");
    } finally {
      f.cleanup();
    }
  });
  it("does not commit or dispatch CI when the snapshot is unchanged", () => {
    const f = fixture();
    try {
      f.git("restore", "data/jobs.generated.json");
      expect(f.run()).toContain("No Laravel job opportunity changes");
      expect(f.git("rev-parse", "HEAD")).toBe(f.baseline);
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
  it("refuses an unrelated staged file", () => {
    const f = fixture();
    try {
      f.git("add", "unrelated.txt");
      expect(() => f.run()).toThrow();
      expect(f.git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(f.baseline);
    } finally {
      f.cleanup();
    }
  });
  it("refuses stale input when main advances instead of rebasing the snapshot", () => {
    const f = fixture();
    try {
      f.git("add", "unrelated.txt");
      f.git("commit", "-m", "concurrent code update");
      const advanced = f.git("rev-parse", "HEAD");
      f.git("push", "origin", "main");
      f.git("reset", "--mixed", f.baseline);
      expect(() => f.run()).toThrow();
      expect(f.git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(advanced);
    } finally {
      f.cleanup();
    }
  });
});

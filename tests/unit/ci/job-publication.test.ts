// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publisher = resolve("automation/ci/commit-jobs.sh");
function scenario(mode: string) {
  const root = mkdtempSync(join(tmpdir(), "job-publication-"));
  const remote = join(root, "remote.git");
  const checkout = join(root, "checkout");
  const bin = join(root, "bin");
  const events = join(root, "events");
  mkdirSync(checkout);
  mkdirSync(bin);
  const git = (args: string[], cwd = checkout) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git(["init", "--bare", remote]);
    git(["init", "-b", "main"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.test"]);
    mkdirSync(join(checkout, "data"));
    writeFileSync(join(checkout, "data/jobs.generated.json"), "[]\n");
    git(["add", "."]);
    git(["commit", "-m", "initial"]);
    git(["remote", "add", "origin", remote]);
    git(["push", "origin", "main"]);
    const base = git(["rev-parse", "HEAD"]);
    writeFileSync(join(checkout, "data/jobs.generated.json"), '[{"id":"new"}]\n');
    writeFileSync(
      join(bin, "gh"),
      `#!/usr/bin/env bash
set -eu
echo "$*" >> "$EVENTS"
case "$1 $2" in
  'workflow run')
    if [ "$MODE" = dispatch-failure ]; then exit 1; fi
    if [ "$MODE" = stale-main ] && [ "$4" != main ]; then
      other="$(printf 'Concurrent main change' | git commit-tree HEAD^{tree} -p "$BASE")"
      git --git-dir="$REMOTE" update-ref refs/heads/main "$other"
    fi
    ;;
  'run list') echo 123 ;;
  'run view')
    if [ "$MODE" = failed-gate ]; then echo failed; else echo verified; fi
    ;;
esac
`,
      { mode: 0o755 }
    );
    let failed = false;
    try {
      execFileSync("bash", [publisher], {
        cwd: checkout,
        stdio: "pipe",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          GITHUB_REF: "refs/heads/main",
          GITHUB_REPOSITORY: "fixture/site",
          GITHUB_RUN_ID: "42",
          GITHUB_RUN_ATTEMPT: "1",
          MODE: mode,
          EVENTS: events,
          REMOTE: remote,
          BASE: base
        }
      });
    } catch {
      failed = true;
    }
    return {
      failed,
      base,
      head: git(["rev-parse", "HEAD"]),
      main: git(["--git-dir", remote, "rev-parse", "main"]),
      snapshot: git(["--git-dir", remote, "show", "main:data/jobs.generated.json"]),
      branches: git(["--git-dir", remote, "branch", "--list"]),
      events: readFileSync(events, "utf8")
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("protected job publication", () => {
  it("checks a temporary branch before fast-forwarding the identical revision and dispatching main CI", () => {
    const result = scenario("success");
    expect(result.failed).toBe(false);
    expect(result.main).toBe(result.head);
    expect(result.main).not.toBe(result.base);
    expect(result.events).toContain("workflow run ci.yml --ref automation/checked-jobs-42-1");
    expect(result.events).toContain(`--commit ${result.head} --event workflow_dispatch`);
    expect(result.events).toContain("workflow run ci.yml --ref main");
    expect(result.branches).not.toContain("checked-jobs");
  });
  for (const mode of ["failed-gate", "dispatch-failure", "stale-main"]) {
    it(`preserves the main snapshot after ${mode}`, () => {
      const result = scenario(mode);
      expect(result.failed).toBe(true);
      expect(result.snapshot).toBe("[]");
      expect(result.main).not.toBe(result.head);
      expect(result.events).not.toContain("workflow run ci.yml --ref main");
      expect(result.branches).toContain("checked-jobs");
    });
  }
});

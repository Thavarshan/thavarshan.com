import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Not a secret — only the token (kept out of any persisted git config, see below) is.
export const applicationsRepoSlug = process.env.APPLICATIONS_REPO_SLUG || "Thavarshan/job-applications";
export const privateRepoDir = resolve(".applications-private");

function run(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed with status ${result.status}`);
  }
}

function runCapture(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function bareUrl() {
  return `https://github.com/${applicationsRepoSlug}.git`;
}

function authedUrl(token: string) {
  return `https://x-access-token:${token}@github.com/${applicationsRepoSlug}.git`;
}

/**
 * Clones (or, if already present, fetches+hard-resets) the private artifact repo. The token is
 * only ever embedded in the remote URL for the single clone/fetch invocation itself — GitHub
 * Actions automatically masks the literal secret value anywhere it appears in job logs, which
 * relies on the value appearing verbatim (not transformed), so the plain embedded-URL form is
 * used rather than an encoded auth header. Immediately after, the remote is reset to a
 * credential-free URL so the token isn't left sitting in `.git/config` on disk for the rest of
 * the job.
 */
export async function clonePrivateRepo(token: string): Promise<string> {
  if (existsSync(resolve(privateRepoDir, ".git"))) {
    run("git", ["-C", privateRepoDir, "remote", "set-url", "origin", authedUrl(token)]);
    run("git", ["-C", privateRepoDir, "fetch", "origin"]);
    run("git", ["-C", privateRepoDir, "reset", "--hard", "origin/HEAD"]);
  } else {
    run("git", ["clone", authedUrl(token), privateRepoDir]);
  }
  run("git", ["-C", privateRepoDir, "remote", "set-url", "origin", bareUrl()]);
  return privateRepoDir;
}

export async function commitAndPush(dir: string, token: string, message: string): Promise<boolean> {
  run("git", ["-C", dir, "config", "user.name", "jobs-application-bot"]);
  run("git", ["-C", dir, "config", "user.email", "applications-bot@users.noreply.github.com"]);
  run("git", ["-C", dir, "add", "-A"]);

  const status = runCapture("git", ["-C", dir, "status", "--porcelain"]);
  if (!status) return false;

  run("git", ["-C", dir, "commit", "-m", message]);
  run("git", ["-C", dir, "remote", "set-url", "origin", authedUrl(token)]);
  try {
    run("git", ["-C", dir, "push", "origin", "HEAD"]);
  } finally {
    run("git", ["-C", dir, "remote", "set-url", "origin", bareUrl()]);
  }
  return true;
}

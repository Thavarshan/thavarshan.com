import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Not a secret — only the deploy key (write access, never persisted to disk beyond a single
// short-lived temp file per invocation) is.
export const applicationsRepoSlug = process.env.APPLICATIONS_REPO_SLUG || "Thavarshan/job-applications";
export const privateRepoDir = resolve(".applications-private");

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, env: options.env, stdio: "inherit" });
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

function sshUrl() {
  return `git@github.com:${applicationsRepoSlug}.git`;
}

/**
 * Writes the deploy key to a short-lived temp file (0600) and returns a GIT_SSH_COMMAND-bearing
 * env for a single git invocation, plus a cleanup callback. A deploy key — unlike a PAT — can
 * only perform git operations on the one repo it was added to, and never touches the GitHub API,
 * which is the whole point of using one here.
 */
async function withDeployKeyEnv<T>(deployKey: string, run: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "applications-deploy-key-"));
  const keyPath = join(dir, "id_ed25519");
  const knownHostsPath = join(dir, "known_hosts");
  try {
    await writeFile(keyPath, deployKey.endsWith("\n") ? deployKey : `${deployKey}\n`);
    await chmod(keyPath, 0o600);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${knownHostsPath}`
    };
    return await run(env);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function clonePrivateRepo(deployKey: string): Promise<string> {
  await withDeployKeyEnv(deployKey, async (env) => {
    if (existsSync(resolve(privateRepoDir, ".git"))) {
      run("git", ["-C", privateRepoDir, "fetch", "origin"], { env });
      run("git", ["-C", privateRepoDir, "reset", "--hard", "origin/HEAD"]);
    } else {
      run("git", ["clone", sshUrl(), privateRepoDir], { env });
    }
  });
  return privateRepoDir;
}

export async function commitAndPush(dir: string, deployKey: string, message: string): Promise<boolean> {
  run("git", ["-C", dir, "config", "user.name", "jobs-application-bot"]);
  run("git", ["-C", dir, "config", "user.email", "applications-bot@users.noreply.github.com"]);
  run("git", ["-C", dir, "add", "-A"]);

  const status = runCapture("git", ["-C", dir, "status", "--porcelain"]);
  if (!status) return false;

  run("git", ["-C", dir, "commit", "-m", message]);
  await withDeployKeyEnv(deployKey, async (env) => {
    run("git", ["-C", dir, "push", "origin", "HEAD"], { env });
  });
  return true;
}

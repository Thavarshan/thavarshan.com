import { spawnSync } from "node:child_process";

const generatedPaths = [
  "data/profile.generated.json",
  "data/github.generated.json",
  "cv/generated/Jerome-Resume.tex"
];

function run(command: string, args: string[], capture = false) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout?.trim() ?? "";
}

function main() {
  const changedFiles = run("git", ["status", "--porcelain"], true)
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3));
  const unrelated = changedFiles.filter((path) => !generatedPaths.includes(path));

  if (unrelated.length > 0) {
    throw new Error(`Refusing to publish with unrelated changes:\n${unrelated.join("\n")}`);
  }
  if (changedFiles.length === 0) {
    throw new Error("There are no generated profile changes to publish");
  }

  run("gh", ["auth", "status"]);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const branch = `profile/sync-${stamp}`;
  run("git", ["switch", "-c", branch]);
  run("git", ["add", ...generatedPaths]);
  run("git", ["commit", "-m", "Update generated professional profile"]);
  run("git", ["push", "-u", "origin", branch]);
  run("gh", [
    "pr",
    "create",
    "--title",
    "Update generated professional profile",
    "--body",
    "Automated LinkedIn archive import, GitHub refresh, and LaTeX CV source update.",
    "--base",
    "main"
  ]);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

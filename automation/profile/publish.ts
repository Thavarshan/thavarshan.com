import { spawnSync } from "node:child_process";

const generatedPaths = [
  "data/profile.generated.json",
  "data/github.generated.json",
  "cv/generated/Jerome-Resume.tex",
  "public/docs/Jerome-Resume.pdf"
];

function run(command: string, args: string[], capture = false) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout ?? "";
}

export function parseChangedFiles(statusOutput: string) {
  const records = statusOutput.split("\0");
  const changedFiles: string[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) {
      continue;
    }

    changedFiles.push(record.slice(3));
    if (/^[RC]/u.test(record.slice(0, 2)) && records[index + 1]) {
      changedFiles.push(records[index + 1]);
      index += 1;
    }
  }

  return changedFiles;
}

function main() {
  const changedFiles = parseChangedFiles(run("git", ["status", "--porcelain=v1", "-z"], true));
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
    "Automated LinkedIn archive import, GitHub refresh, LaTeX CV source update, and public CV artifact refresh.",
    "--base",
    "main"
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

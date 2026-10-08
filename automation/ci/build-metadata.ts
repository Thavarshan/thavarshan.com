import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

export function buildMetadata(revision: string, context: string) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Build revision must be a full commit SHA");
  return { schemaVersion: 1, revision, context };
}

export function deploymentHeaders(context: string) {
  const marker = "/build-info.json\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n";
  return marker + (["deploy-preview", "branch-deploy"].includes(context) ? "/*\n  X-Robots-Tag: noindex, nofollow\n" : "");
}

async function main() {
  const revision = process.env.COMMIT_REF || process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const context = process.env.CONTEXT || "local";
  await writeFile("out/build-info.json", JSON.stringify(buildMetadata(revision, context)) + "\n");
  await writeFile("out/_headers", deploymentHeaders(context));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

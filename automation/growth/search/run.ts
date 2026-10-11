import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { applicationsRepoSlug, clonePrivateRepo, commitAndPush, privateRepoDir } from "../../applications/private-repo";
import { getAllInsights } from "../../../src/features/insights/insights.node";
import { tools } from "../../../src/features/tools/registry";
import { githubSnapshotSchema } from "../../../src/features/github/github-model";
import { analyzeSearch, searchPolicy, type PublicSearchStatus } from "./model";
import { collectGoogleSearch } from "./google";

export async function boundedPrivateJson(path: string): Promise<unknown | undefined> {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("Private search input could not be opened", { cause: error });
  }
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > searchPolicy.maxBytes) throw new Error("Invalid private search file");
    const content = await file.readFile();
    if (content.length > searchPolicy.maxBytes) throw new Error("Private search input exceeds limit");
    return JSON.parse(content.toString("utf8"));
  } finally {
    await file.close();
  }
}

export async function publicContentPaths() {
  const github = githubSnapshotSchema.parse(JSON.parse(await readFile("data/github.generated.json", "utf8")));
  return new Set([
    "/",
    "/cv",
    "/projects",
    "/insights",
    "/tools",
    "/privacy",
    ...github.projects.map((project) => `/projects/${project.repository}`),
    ...getAllInsights().map((insight) => `/insights/${insight.slug}`),
    ...tools.map((tool) => `/tools/${tool.slug}`)
  ]);
}

/** Private write path is isolated from the public report collector and its artifacts. */
export async function prepareSearchFeedback(options: {
  env: Record<string, string | undefined>;
  now: Date;
  knownPaths: Set<string>;
  clone?: typeof clonePrivateRepo;
  commit?: typeof commitAndPush;
  collect?: typeof collectGoogleSearch;
}): Promise<PublicSearchStatus> {
  const { env, now, knownPaths } = options;
  if (env.GITHUB_REF !== "refs/heads/main") throw new Error("Private search automation requires trusted main");
  const key = env.APPLICATIONS_REPO_DEPLOY_KEY;
  const credentials = env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!key) {
    if (credentials) throw new Error("Private publication is not configured");
    return { schemaVersion: 1, status: "unavailable" };
  }
  if (applicationsRepoSlug.toLowerCase() === "thavarshan/thavarshan.com") throw new Error("Search output must use the private repository");
  const directory = await (options.clone ?? clonePrivateRepo)(key);
  const root = join(directory, "search-performance");
  try {
    if (!(await lstat(root)).isDirectory()) throw new Error("Invalid private search directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Invalid private search directory", { cause: error });
  }
  const sources: Array<{ name: "google" | "bing"; raw: unknown }> = [];
  if (credentials)
    sources.push({ name: "google", raw: await (options.collect ?? collectGoogleSearch)(credentials, env.GOOGLE_SEARCH_CONSOLE_PROPERTY || undefined, now) });
  else {
    const google = await boundedPrivateJson(join(root, "google.json"));
    if (google !== undefined) sources.push({ name: "google", raw: google });
  }
  const bing = await boundedPrivateJson(join(root, "bing.json"));
  if (bing !== undefined) sources.push({ name: "bing", raw: bing });
  if (!sources.length) return { schemaVersion: 1, status: "unavailable" };
  const results = [];
  // Validate every configured source before writing or publishing any new state.
  for (const source of sources) {
    const indexing = await boundedPrivateJson(join(root, `${source.name}-indexing.json`));
    const result = analyzeSearch(source.raw, knownPaths, now, indexing);
    if (result.report.source !== source.name) throw new Error("Unexpected private search source");
    results.push({ ...source, result });
  }
  await mkdir(root, { recursive: true });
  for (const { name, raw, result } of results) {
    await writePrivate(join(root, `${name}.json`), JSON.stringify(raw, null, 2) + "\n");
    await writePrivate(join(root, `${name}-report.json`), JSON.stringify(result.report, null, 2) + "\n");
    await writePrivate(join(root, `${name}-content-plan.json`), JSON.stringify(result.plan, null, 2) + "\n");
    await writePrivate(join(root, `${name}-summary.md`), result.summary);
  }
  await (options.commit ?? commitAndPush)(directory, key, "Update private search feedback and content review plan");
  const statuses = results.map((item) => item.result.report.status);
  return { schemaVersion: 1, status: statuses.includes("stale") ? "stale" : statuses.every((status) => status === "no-data") ? "no-data" : "available" };
}

async function writePrivate(path: string, content: string) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try {
    await file.writeFile(content);
  } finally {
    await file.close();
  }
}

export async function readContentPriorities(directory: string, knownPaths: Set<string>, now = new Date()) {
  const root = join(directory, "search-performance");
  try {
    if (!(await lstat(root)).isDirectory()) throw new Error("Invalid private search directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const plans = [];
  for (const source of ["google", "bing"] as const) {
    const raw = await boundedPrivateJson(join(root, `${source}.json`));
    if (raw === undefined) continue;
    const result = analyzeSearch(raw, knownPaths, now);
    if (result.report.source !== source) throw new Error("Unexpected content priority source");
    if (result.report.status === "available") plans.push(result.plan);
  }
  return plans;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--content-plan") {
    if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Private content planning requires trusted main");
    const key = process.env.APPLICATIONS_REPO_DEPLOY_KEY;
    if (!key) {
      console.log("Private content priorities unavailable; no private key is configured.");
      return;
    }
    if (applicationsRepoSlug.toLowerCase() === "thavarshan/thavarshan.com") throw new Error("Private content plans require the private repository");
    try {
      const directory = await clonePrivateRepo(key);
      const plans = await readContentPriorities(directory, await publicContentPaths());
      await mkdir(".search-feedback", { recursive: true });
      await writeFile(".search-feedback/content-plan.json", JSON.stringify({ schemaVersion: 1, requiresHumanReview: true, sources: plans }, null, 2) + "\n");
      console.log(
        plans.length
          ? "Private content priorities loaded for human review; no public content was edited."
          : "No fresh private content priorities are available."
      );
    } finally {
      await rm(privateRepoDir, { recursive: true, force: true });
    }
    return;
  }
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--input") throw new Error("Use --input PATH for private offline analysis");
    const raw = await boundedPrivateJson(resolve(args[1]));
    const result = analyzeSearch(raw, await publicContentPaths());
    await mkdir(".search-feedback", { recursive: true });
    await writeFile(".search-feedback/report.json", JSON.stringify(result.report, null, 2) + "\n");
    await writeFile(".search-feedback/content-plan.json", JSON.stringify(result.plan, null, 2) + "\n");
    await writeFile(".search-feedback/summary.md", result.summary);
    console.log("Private offline feedback written to the ignored .search-feedback directory.");
    return;
  }
  let status: PublicSearchStatus = { schemaVersion: 1, status: "failed" };
  try {
    status = await prepareSearchFeedback({ env: process.env, now: new Date(), knownPaths: await publicContentPaths() });
  } catch {
    process.exitCode = 1;
  } finally {
    await rm(privateRepoDir, { recursive: true, force: true });
    await mkdir("test-results/search-status", { recursive: true });
    await writeFile("test-results/search-status/status.json", JSON.stringify(status) + "\n");
  }
  console.log(`Search feedback: ${status.status}. Query data and recommendations remain private; inspect configuration/access if unavailable or failed.`);
}
if (import.meta.url === `file://${process.argv[1]}`)
  await main().catch(() => {
    console.error("Search feedback failed; private output and credentials were suppressed.");
    process.exitCode = 1;
  });

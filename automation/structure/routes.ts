import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/**
 * Public-URL inventory for the static export (`out/`). The repository restructuring must not change a
 * single public URL, so this records the route PATTERNS the export serves and fails if they change.
 * Dynamic pages (one per insight, project, tool) are normalised to `[slug]` so ordinary content updates
 * do not trip it, while adding, removing or renaming a route kind does.
 */

/** Directories whose children are generated per content item. */
export const dynamicPrefixes = ["insights", "projects", "tools"] as const;

export interface Inventory {
  /** HTML pages, as served URL paths (`/cv`, `/projects/[slug]`). */
  pages: string[];
  /** Machine-readable and social files (sitemap, feed, robots, opengraph images, ...). */
  files: string[];
  /** Static public assets copied from `public/`. */
  assets: string[];
  /** Dynamic route kinds and how many concrete pages each produced (must stay >= 1). */
  dynamicCounts: Record<string, number>;
}

const ignore = (path: string) => path.startsWith("_next/") || path.startsWith("__next") || /(^|\/)__next[^/]*$/.test(path) || path.endsWith(".txt") && path !== "robots.txt" && path !== "indexnow-key.txt";
const assetPattern = /\.(png|jpe?g|ico|pdf|webmanifest|svg|webp)$/i;
const generatedFiles = new Set(["sitemap.xml", "feed.xml", "robots.txt", "indexnow-key.txt", "_redirects", "opengraph-image"]);

function normalise(path: string): { kind: "page" | "file" | "asset"; pattern: string; dynamic?: string } | null {
  if (ignore(path)) return null;
  const segments = path.split("/");
  const dynamic = dynamicPrefixes.find((prefix) => segments[0] === prefix && segments.length > 1);

  if (path.endsWith(".html")) {
    const url = path === "index.html" ? "/" : `/${path.replace(/\.html$/, "")}`;
    if (dynamic) return { kind: "page", pattern: `/${dynamic}/[slug]`, dynamic };
    return { kind: "page", pattern: url };
  }
  if (segments.at(-1) === "opengraph-image") {
    if (dynamic) return { kind: "file", pattern: `/${dynamic}/[slug]/opengraph-image`, dynamic: `${dynamic}:og` };
    return { kind: "file", pattern: `/${path}` };
  }
  if (assetPattern.test(path)) return { kind: "asset", pattern: `/${path}` };
  if (generatedFiles.has(path) || /\.(xml|txt)$/.test(path)) return { kind: "file", pattern: `/${path}` };
  return { kind: "file", pattern: `/${path}` };
}

export function buildInventory(files: string[]): Inventory {
  const pages = new Set<string>();
  const generated = new Set<string>();
  const assets = new Set<string>();
  const dynamicCounts: Record<string, number> = {};

  for (const file of files) {
    const entry = normalise(file);
    if (!entry) continue;
    if (entry.dynamic) dynamicCounts[entry.dynamic] = (dynamicCounts[entry.dynamic] ?? 0) + 1;
    (entry.kind === "page" ? pages : entry.kind === "asset" ? assets : generated).add(entry.pattern);
  }

  const sorted = (set: Set<string>) => [...set].sort();
  return {
    pages: sorted(pages),
    files: sorted(generated),
    assets: sorted(assets),
    dynamicCounts: Object.fromEntries(Object.entries(dynamicCounts).sort(([a], [b]) => a.localeCompare(b)))
  };
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? listFiles(root, join(directory, entry.name)) : [relative(root, join(directory, entry.name))])));
  return nested.flat();
}

/** Returns human-readable differences between the expected and actual inventories (empty = identical). */
export function diffInventories(expected: Inventory, actual: Inventory): string[] {
  const problems: string[] = [];
  for (const key of ["pages", "files", "assets"] as const) {
    for (const missing of expected[key].filter((item) => !actual[key].includes(item))) problems.push(`missing ${key.slice(0, -1)}: ${missing}`);
    for (const extra of actual[key].filter((item) => !expected[key].includes(item))) problems.push(`unexpected ${key.slice(0, -1)}: ${extra}`);
  }
  for (const kind of Object.keys(expected.dynamicCounts)) {
    if ((actual.dynamicCounts[kind] ?? 0) < 1) problems.push(`dynamic route "${kind}" produced no pages`);
  }
  for (const kind of Object.keys(actual.dynamicCounts)) {
    if (!(kind in expected.dynamicCounts)) problems.push(`unexpected dynamic route kind: ${kind}`);
  }
  return problems;
}

const fixturePath = resolve("tests/fixtures/structure/routes.json");

async function main() {
  const actual = buildInventory(await listFiles(resolve("out")));
  if (process.argv.includes("--write")) {
    // Counts vary with content, so the fixture records only which dynamic kinds exist.
    const normalised = { ...actual, dynamicCounts: Object.fromEntries(Object.keys(actual.dynamicCounts).map((kind) => [kind, 1])) };
    await writeFile(fixturePath, `${JSON.stringify(normalised, null, 2)}\n`, "utf8");
    console.log(`Wrote ${fixturePath}`);
    return;
  }
  const expected = JSON.parse(await readFile(fixturePath, "utf8")) as Inventory;
  const problems = diffInventories(expected, actual);
  if (problems.length > 0) {
    console.error(`The public URL inventory changed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}\nIf this is intentional, run \`npm run structure:routes -- --write\` and review the diff.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Public URL inventory unchanged: ${actual.pages.length} page patterns, ${actual.files.length} generated files, ${actual.assets.length} assets.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

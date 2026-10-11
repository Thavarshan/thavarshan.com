import { createHash } from "node:crypto";
import { lstat, readFile, readdir, mkdir, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import positioning from "../../marketing/search-positioning.json";
import { positioningSchema, type Positioning } from "./positioning/model";
import { getAllInsights } from "../../src/features/insights/insights.node";
import { tools } from "../../src/features/tools/registry";
import { profile } from "../../src/features/profile/profile";
import github from "../../data/github.generated.json";

const date = z.iso.date();
const route = z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
export const reviewStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    capturedAt: date,
    pages: z
      .array(
        z
          .object({
            path: route,
            sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
            reviewedAt: date.nullable()
          })
          .strict()
      )
      .max(500)
  })
  .strict();
export const contentReviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.iso.datetime(),
    pages: z
      .array(
        z
          .object({
            path: route,
            reviewedAt: date.nullable(),
            ageDays: z.number().int().nonnegative().nullable(),
            intervalDays: z.number().int().positive(),
            sourceDate: date.nullable(),
            sourceAgeDays: z.number().int().nonnegative().nullable(),
            unreviewed: z.boolean(),
            overdue: z.boolean(),
            sourceChanged: z.boolean()
          })
          .strict()
      )
      .max(500)
  })
  .strict();
export type ContentReview = z.infer<typeof contentReviewSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

export function reviewInterval(path: string) {
  if (path === "/privacy") return 365;
  if (path === "/" || path === "/cv" || path.startsWith("/tools/")) return 90;
  return 180;
}

/** Review age is not content accuracy; source changes and deadlines only request human inspection. */
export function buildContentReview(
  map: Positioning,
  state: unknown,
  digests: Record<string, string>,
  now: Date,
  sourceDates: Record<string, string> = {}
): ContentReview {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid content review time");
  const baseline = reviewStateSchema.parse(state);
  const calendarParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => calendarParts.find((item) => item.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const daysSince = (value: string) => Math.floor((Date.parse(today) - Date.parse(value)) / 86_400_000);
  if (baseline.capturedAt > today || new Set(baseline.pages.map((page) => page.path)).size !== baseline.pages.length)
    throw new Error("Invalid content review baseline");
  const known = new Set(map.pages.map((page) => page.path));
  if (baseline.pages.some((page) => !known.has(page.path) || (page.reviewedAt !== null && page.reviewedAt > today)))
    throw new Error("Invalid content review record");
  return contentReviewSchema.parse({
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    pages: map.pages.map((page) => {
      const previous = baseline.pages.find((record) => record.path === page.path);
      if (!/^[a-f0-9]{64}$/.test(digests[page.path] ?? "")) throw new Error("Missing public source digest");
      const reviewedAt = previous?.reviewedAt ?? null;
      const ageDays = reviewedAt === null ? null : daysSince(reviewedAt);
      const intervalDays = reviewInterval(page.path);
      const sourceDate = sourceDates[page.path] === undefined ? null : date.parse(sourceDates[page.path]);
      if (sourceDate !== null && sourceDate > today) throw new Error("Future public source date");
      const sourceAgeDays = sourceDate === null ? null : daysSince(sourceDate);
      return {
        path: page.path,
        reviewedAt,
        ageDays,
        intervalDays,
        sourceDate,
        sourceAgeDays,
        unreviewed: reviewedAt === null,
        overdue: ageDays !== null && ageDays >= intervalDays,
        sourceChanged: !previous || previous.sourceDigest !== digests[page.path]
      };
    })
  });
}

/** Ignore collection churn; retain authored descriptions, README excerpts, skills and career evidence. */
export function stableEvidence(path: string, content: string, pagePath: string) {
  if (path === "data/github.generated.json") {
    const snapshot = JSON.parse(content);
    return JSON.stringify(
      snapshot.projects
        .filter((project: { repository: string }) => !pagePath.startsWith("/projects/") || pagePath === `/projects/${project.repository}`)
        .map((project: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(project).filter(([key]) => !["stars", "forks", "updatedAt"].includes(key)))
        )
    );
  }
  if (path === "data/profile.generated.json") {
    const profile = JSON.parse(content);
    return JSON.stringify(Object.fromEntries(Object.entries(profile).filter(([key]) => !["modifiedAt", "sources"].includes(key))));
  }
  return content;
}

async function sourceFiles(path: string): Promise<string[]> {
  if (!/^(src|data|content)\/[a-zA-Z0-9/._[\]-]+$/.test(path) || path.split("/").some((part) => part === ".." || part === "."))
    throw new Error("Invalid public evidence path");
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error("Public evidence cannot be a symlink");
  if (info.isFile()) {
    if (info.size > 2 * 1024 * 1024) throw new Error("Public evidence exceeds limit");
    return [path];
  }
  if (!info.isDirectory()) throw new Error("Invalid evidence source");
  const children = await readdir(path);
  if (children.length > 500) throw new Error("Public evidence directory exceeds limit");
  return (await Promise.all(children.sort().map((name) => sourceFiles(join(path, name))))).flat();
}

export async function publicSourceDigests(map = positioningSchema.parse(positioning)) {
  const digests: Record<string, string> = {};
  for (const page of map.pages) {
    const paths = [...new Set((await Promise.all(page.evidence.map(sourceFiles))).flat())].sort();
    const hash = createHash("sha256");
    for (const path of paths) hash.update(JSON.stringify([path, stableEvidence(path, await readFile(path, "utf8"), page.path)]));
    digests[page.path] = hash.digest("hex");
  }
  return digests;
}

export async function collectContentReview(now = new Date()) {
  const map = positioningSchema.parse(positioning);
  const state = JSON.parse(await readFile("marketing/content-review-state.json", "utf8"));
  const insights = getAllInsights();
  const dates: Record<string, string> = {
    "/": profile.modifiedAt.slice(0, 10),
    "/cv": profile.modifiedAt.slice(0, 10),
    "/privacy": profile.modifiedAt.slice(0, 10),
    ...Object.fromEntries(insights.map((insight) => [`/insights/${insight.slug}`, insight.updatedAt ?? insight.publishedAt])),
    ...Object.fromEntries(tools.map((tool) => [`/tools/${tool.slug}`, tool.dateModified])),
    ...Object.fromEntries(github.projects.map((project) => [`/projects/${project.repository}`, project.updatedAt.slice(0, 10)]))
  };
  for (const prefix of ["insights", "tools", "projects"]) {
    const latest = Object.entries(dates)
      .filter(([path]) => path.startsWith(`/${prefix}/`))
      .map(([, value]) => value)
      .sort()
      .at(-1);
    if (latest) dates[`/${prefix}`] = latest;
  }
  return buildContentReview(map, state, await publicSourceDigests(map), now, dates);
}

export function renderContentReview(report: ContentReview) {
  const pending = report.pages.filter((page) => page.unreviewed || page.overdue || page.sourceChanged);
  return (
    `## Public content review\n\n${pending.length} of ${report.pages.length} pages need human review. These are editorial signals, not evidence of incorrect content or search performance.\n\n` +
    pending
      .map(
        (page) =>
          `- ${page.path}: ${[page.unreviewed && "unreviewed", page.overdue && "review overdue", page.sourceChanged && "public source changed"].filter(Boolean).join(", ")}; public source age ${page.sourceAgeDays === null ? "unknown" : `${page.sourceAgeDays}d`}.`
      )
      .join("\n") +
    "\n\nReview fresh search opportunities in the private search-performance report; query data and tasks are never copied into this public report.\n"
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (process.argv.length !== 2) throw new Error("Content review takes no arguments");
    const report = await collectContentReview();
    await mkdir("test-results/content-review", { recursive: true });
    await writeFile("test-results/content-review/report.json", JSON.stringify(report, null, 2) + "\n");
    const summary = renderContentReview(report);
    await writeFile("test-results/content-review/summary.md", summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(summary);
  } catch {
    console.error("Public content review unavailable; no content or review records were changed.");
    process.exitCode = 1;
  }
}

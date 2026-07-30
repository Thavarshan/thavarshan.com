import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseInsightSource, type Insight } from "@/lib/insight-model";

const contentDirectory = join(process.cwd(), "content", "insights");

export function getAllInsights({ includeDrafts = false } = {}) {
  const insights = readdirSync(contentDirectory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => parseInsightSource(readFileSync(join(contentDirectory, file), "utf8")))
    .filter((insight) => includeDrafts || !insight.draft)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  assertUniqueInsightSlugs(insights);

  return insights;
}

export function assertUniqueInsightSlugs(insights: Pick<Insight, "slug">[]) {
  const slugs = new Set<string>();
  for (const insight of insights) {
    if (slugs.has(insight.slug)) {
      throw new Error(`Duplicate insight slug: ${insight.slug}`);
    }
    slugs.add(insight.slug);
  }
}

export function validateInsightProjectReferences(insights: Pick<Insight, "slug" | "relatedProjects">[], repositories: string[]) {
  const available = new Set(repositories);
  const missing = insights.flatMap((insight) =>
    insight.relatedProjects
      .filter((repository) => !available.has(repository))
      .map((repository) => `${insight.slug} references missing project ${repository}`)
  );

  if (missing.length) {
    throw new Error(missing.join("\n"));
  }
}

export function getFeaturedInsights(limit = 3) {
  return getAllInsights().filter((insight) => insight.featured).slice(0, limit);
}

export function getInsightBySlug(slug: string) {
  return getAllInsights().find((insight) => insight.slug === slug);
}

export function getRelatedInsightsForProject(repository: string, limit = 2) {
  return getAllInsights()
    .filter((insight) => insight.relatedProjects.includes(repository))
    .slice(0, limit);
}

export function getInsightUrl(slug: string) {
  return `/insights/${slug}`;
}

export function getAbsoluteInsightUrl(slug: string, siteUrl: string) {
  return `${siteUrl}${getInsightUrl(slug)}`;
}

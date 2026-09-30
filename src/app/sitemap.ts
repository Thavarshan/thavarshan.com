import type { MetadataRoute } from "next";
import githubData from "@generated/github.generated.json";
import { profile } from "@/features/profile/profile";
import { site } from "@/features/profile/site";
import { githubSnapshotSchema } from "@/features/github/github-model";
import { getAllInsights } from "@/features/insights/insights";
import { toolUrl, tools } from "@/features/tools/registry";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const github = githubSnapshotSchema.parse(githubData);
  const insights = getAllInsights();

  return [
    {
      url: site.url,
      lastModified: profile.modifiedAt,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${site.url}/cv`,
      lastModified: profile.modifiedAt,
      changeFrequency: "monthly",
      priority: 0.9
    },
    {
      url: `${site.url}/projects`,
      lastModified: github.syncedAt,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${site.url}/insights`,
      lastModified: insights[0]?.updatedAt ?? insights[0]?.publishedAt ?? profile.modifiedAt,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${site.url}/tools`,
      lastModified: tools.map((tool) => tool.dateModified).sort().at(-1) ?? profile.modifiedAt,
      changeFrequency: "monthly",
      priority: 0.8
    },
    ...tools.map((tool) => ({
      url: toolUrl(tool.slug),
      lastModified: tool.dateModified,
      changeFrequency: "monthly" as const,
      priority: 0.8
    })),
    {
      url: `${site.url}/privacy`,
      lastModified: profile.modifiedAt,
      changeFrequency: "yearly",
      priority: 0.3
    },
    ...insights.map((insight) => ({
      url: `${site.url}/insights/${insight.slug}`,
      lastModified: insight.updatedAt ?? insight.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.85
    })),
    ...github.projects.map((project) => ({
      url: `${site.url}/projects/${project.repository}`,
      lastModified: project.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}

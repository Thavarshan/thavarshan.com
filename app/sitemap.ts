import type { MetadataRoute } from "next";
import githubData from "@/data/github.generated.json";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { githubSnapshotSchema } from "@/lib/github-model";
import { getAllInsights } from "@/lib/insights";

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

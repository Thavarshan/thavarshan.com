import type { MetadataRoute } from "next";
import githubData from "@/data/github.generated.json";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { githubSnapshotSchema } from "@/lib/github-model";

export default function sitemap(): MetadataRoute.Sitemap {
  const github = githubSnapshotSchema.parse(githubData);

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
    ...github.projects.map((project) => ({
      url: `${site.url}/projects/${project.repository}`,
      lastModified: project.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}

import "server-only";
import type { FeaturedProject } from "@/data/projects";
import { getGitHubSnapshot } from "@/lib/github";
import type { GitHubProject } from "@/lib/github-model";

function toFeaturedProject(project: GitHubProject, displayOrder: number): FeaturedProject {
  return {
    name: project.name,
    repository: project.repository,
    role: "Creator and maintainer",
    summary: project.description,
    highlights: project.readmeExcerpt.slice(0, 2),
    tags: [project.primaryLanguage, ...project.topics].filter((value): value is string => Boolean(value)).slice(0, 5),
    ...(project.homepage ? { homepage: project.homepage } : {}),
    displayOrder,
    stats: {
      stars: project.stars,
      forks: project.forks,
      primaryLanguage: project.primaryLanguage ?? null,
      url: project.repositoryUrl,
      lastUpdatedAt: project.updatedAt
    }
  };
}

export async function getFeaturedProjects(): Promise<FeaturedProject[]> {
  const snapshot = await getGitHubSnapshot();
  return snapshot.projects.map(toFeaturedProject);
}

export async function getFeaturedGitHubProjects() {
  return (await getGitHubSnapshot()).projects;
}

export async function getFeaturedGitHubProject(repository: string) {
  return (await getGitHubSnapshot()).projects.find((project) => project.repository === repository);
}

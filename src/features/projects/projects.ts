import "server-only";
import type { FeaturedProject } from "@/features/projects/featured-projects";
import { getStaticGitHubSnapshot } from "@/features/projects/github";
import type { GitHubProject } from "@/features/projects/github-model";

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
  const snapshot = getStaticGitHubSnapshot();
  return snapshot.projects.map(toFeaturedProject);
}

export async function getFeaturedGitHubProjects() {
  return getStaticGitHubSnapshot().projects;
}

export async function getFeaturedGitHubProject(repository: string) {
  return getStaticGitHubSnapshot().projects.find((project) => project.repository === repository);
}

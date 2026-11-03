import "server-only";
import type { FeaturedProject } from "@/features/projects/featured-projects";
import { getStaticGitHubSnapshot } from "@/features/github/github";
import type { GitHubProject } from "@/features/github/github-model";
import { profile } from "@/features/profile/profile";

const honeymelonProfile = profile.resumeProjects?.find((project) => project.id === "honeymelon");
const honeymelonProduct = profile.professionalProjects.find((project) => project.id === "honeymelon");

function toFeaturedProject(project: GitHubProject, displayOrder: number): FeaturedProject {
  const honeymelonProject = project.repository === "comet" ? honeymelonProfile : undefined;
  const homepage = honeymelonProject ? honeymelonProduct?.url : project.homepage;
  return {
    name: honeymelonProject ? honeymelonProject.name : project.name,
    repository: project.repository,
    role: honeymelonProject ? honeymelonProject.role : "Creator and maintainer",
    summary: honeymelonProject ? honeymelonProject.description : project.description,
    highlights: honeymelonProject ? honeymelonProject.highlights : project.readmeExcerpt.slice(0, 2),
    tags: honeymelonProject
      ? honeymelonProject.tags
      : [project.primaryLanguage, ...project.topics].filter((value): value is string => Boolean(value)).slice(0, 5),
    ...(homepage ? { homepage } : {}),
    displayOrder,
    stats: {
      stars: project.stars,
      forks: project.forks,
      primaryLanguage: project.primaryLanguage ?? null,
      url: honeymelonProject ? (honeymelonProject.url ?? project.repositoryUrl) : project.repositoryUrl,
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
  const project = getStaticGitHubSnapshot().projects.find((item) => item.repository === repository);
  if (!project) return undefined;

  const honeymelon = repository === "comet" ? honeymelonProfile : undefined;
  if (!honeymelon) return project;

  return {
    ...project,
    name: honeymelon.name,
    description: honeymelon.description,
    topics: honeymelon.tags,
    homepage: honeymelonProduct?.url ?? project.homepage,
    repositoryUrl: honeymelon.url ?? project.repositoryUrl,
    readmeExcerpt: [honeymelon.description, ...honeymelon.highlights]
  };
}

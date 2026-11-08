import "server-only";
import type { FeaturedProject } from "@/features/projects/featured-projects";
import { getStaticGitHubSnapshot } from "@/features/github/github";
import type { GitHubProject } from "@/features/github/github-model";
import { profile } from "@/features/profile/profile";

const honeymelonProfile = profile.resumeProjects?.find((project) => project.id === "honeymelon");
const dokimosProfile = profile.resumeProjects?.find((project) => project.id === "dokimos");

function resumeProjectFor(repository: string) {
  if (repository === "comet" || repository === "honeymelon") return honeymelonProfile;
  if (repository === "dokimos") return dokimosProfile;
  return undefined;
}

function toFeaturedProject(project: GitHubProject, displayOrder: number): FeaturedProject {
  const profileProject = resumeProjectFor(project.repository);
  return {
    name: profileProject ? profileProject.name : project.name,
    repository: project.repository,
    role: profileProject ? profileProject.role : "Creator and maintainer",
    summary: profileProject ? profileProject.description : project.description,
    highlights: profileProject ? profileProject.highlights : project.readmeExcerpt.slice(0, 2),
    tags: profileProject ? profileProject.tags : [project.primaryLanguage, ...project.topics].filter((value): value is string => Boolean(value)).slice(0, 5),
    ...(project.homepage ? { homepage: project.homepage } : {}),
    displayOrder,
    stats: {
      stars: project.stars,
      forks: project.forks,
      primaryLanguage: project.primaryLanguage ?? null,
      url: profileProject?.url ?? project.repositoryUrl,
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

  const profileProject = resumeProjectFor(repository);
  if (!profileProject) return project;

  return {
    ...project,
    name: profileProject.name,
    description: profileProject.description,
    topics: profileProject.tags,
    repositoryUrl: profileProject.url ?? project.repositoryUrl,
    readmeExcerpt: [profileProject.description, ...profileProject.highlights]
  };
}

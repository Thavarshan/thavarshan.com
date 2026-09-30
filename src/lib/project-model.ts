import type { FeaturedProject, GitHubRepositoryStats, ProjectDefinition } from "@/data/projects";
import { site } from "@/data/site";

export function mergeProjectDefinitions(
  definitions: ProjectDefinition[],
  statsByRepository: Map<string, GitHubRepositoryStats>
): FeaturedProject[] {
  return definitions
    .map((definition) => ({
      ...definition,
      stats: statsByRepository.get(definition.repository)
    }))
    .sort((a, b) => {
      const starsA = a.stats?.stars ?? Number.NEGATIVE_INFINITY;
      const starsB = b.stats?.stars ?? Number.NEGATIVE_INFINITY;

      if (starsA !== starsB) {
        return starsB - starsA;
      }

      return a.displayOrder - b.displayOrder;
    });
}

export function formatStarTotal(totalStars: number) {
  if (totalStars < 1000) {
    return { value: totalStars, label: totalStars.toLocaleString(), suffix: "" };
  }

  const rounded = Math.floor(totalStars / 100) * 100;
  return { value: rounded, label: `${rounded.toLocaleString()}+`, suffix: "+" };
}

export function getResumeHref() {
  return site.resume;
}

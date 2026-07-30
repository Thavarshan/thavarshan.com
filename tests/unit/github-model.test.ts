import { describe, expect, it } from "vitest";
import {
  cleanGitHubDescription,
  extractReadmeExcerpt,
  formatRepositoryName,
  selectFeaturedRepositories,
  type RepositoryCandidate
} from "@/lib/github-model";

function project(repository: string, stars: number, overrides: Partial<RepositoryCandidate> = {}): RepositoryCandidate {
  return {
    repository,
    name: repository,
    description: `${repository} description`,
    topics: [],
    stars,
    forks: 0,
    repositoryUrl: `https://github.com/Thavarshan/${repository}`,
    updatedAt: "2026-01-01T00:00:00.000Z",
    readmeExcerpt: [],
    ...overrides
  };
}

describe("GitHub project model", () => {
  it("selects the highest-starred maintained owner repositories", () => {
    const result = selectFeaturedRepositories(
      [
        project("second", 20),
        project("first", 50),
        project("fork", 100, { fork: true }),
        project("archived", 90, { archived: true }),
        project("excluded", 80)
      ],
      2,
      ["excluded"]
    );

    expect(result.map((item) => item.repository)).toEqual(["first", "second"]);
  });

  it("extracts plain, bounded README paragraphs without markup", () => {
    expect(
      extractReadmeExcerpt(
        "# Project\n\n[Documentation](https://example.com) provides a clear and detailed introduction to this project.\n\n![Badge](badge.svg)\n\nSecond useful paragraph with enough context for an indexable project page."
      )
    ).toEqual([
      "Documentation provides a clear and detailed introduction to this project.",
      "Second useful paragraph with enough context for an indexable project page."
    ]);
  });

  it("normalizes repository display text without changing repository identity", () => {
    expect(formatRepositoryName("fetch-php")).toBe("Fetch PHP");
    expect(cleanGitHubDescription("🚀 Modern PHP client")).toBe("Modern PHP client");
  });
});

import { describe, expect, it } from "vitest";
import { projectDefinitions, type GitHubRepositoryStats } from "@/data/projects";
import { formatStarTotal, getResumeHref, mergeProjectDefinitions } from "@/lib/project-model";

describe("project data", () => {
  it("sorts repositories by live stars when stats are present", () => {
    const stats = new Map<string, GitHubRepositoryStats>([
      [
        "phpvm",
        {
          stars: 500,
          forks: 10,
          primaryLanguage: "Shell",
          url: "https://github.com/Thavarshan/phpvm",
          lastUpdatedAt: "2026-01-01T00:00:00Z"
        }
      ],
      [
        "fetch-php",
        {
          stars: 100,
          forks: 10,
          primaryLanguage: "PHP",
          url: "https://github.com/Thavarshan/fetch-php",
          lastUpdatedAt: "2026-01-01T00:00:00Z"
        }
      ]
    ]);

    const projects = mergeProjectDefinitions(projectDefinitions, stats);

    expect(projects[0].repository).toBe("phpvm");
    expect(projects[1].repository).toBe("fetch-php");
  });

  it("falls back to curated order when GitHub stats are missing", () => {
    const projects = mergeProjectDefinitions(projectDefinitions, new Map());

    expect(projects.map((project) => project.repository)).toEqual([
      "fetch-php",
      "filterable",
      "phpvm",
      "comet",
      "matrix"
    ]);
    expect(projects.every((project) => project.stats === undefined)).toBe(true);
  });

  it("uses a stable resume path", () => {
    expect(getResumeHref()).toBe("/docs/Jerome-Resume.pdf");
  });

  it("rounds star totals down to a recruiter-friendly threshold", () => {
    expect(formatStarTotal(1026)).toEqual({ value: 1000, label: "1,000+", suffix: "+" });
    expect(formatStarTotal(842)).toEqual({ value: 842, label: "842", suffix: "" });
    expect(formatStarTotal(0)).toEqual({ value: 0, label: "0", suffix: "" });
  });
});

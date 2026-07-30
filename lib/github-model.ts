import { z } from "zod";

export const githubProjectSchema = z.object({
  repository: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  topics: z.array(z.string()),
  primaryLanguage: z.string().nullable().optional(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  homepage: z.string().url().optional(),
  repositoryUrl: z.string().url(),
  updatedAt: z.string().datetime(),
  readmeExcerpt: z.array(z.string().min(1)).default([])
});

export const githubSnapshotSchema = z.object({
  username: z.string().min(1),
  name: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  bio: z.string().nullable(),
  profileUrl: z.string().url(),
  followers: z.number().int().nonnegative(),
  publicRepositories: z.number().int().nonnegative(),
  syncedAt: z.string().datetime(),
  projects: z.array(githubProjectSchema)
});

export type GitHubProject = z.infer<typeof githubProjectSchema>;
export type GitHubSnapshot = z.infer<typeof githubSnapshotSchema>;

export type RepositoryCandidate = GitHubProject & {
  fork?: boolean;
  archived?: boolean;
  disabled?: boolean;
};

export function selectFeaturedRepositories(
  repositories: RepositoryCandidate[],
  count: number,
  excludedRepositories: readonly string[]
) {
  const excluded = new Set(excludedRepositories.map((repository) => repository.toLowerCase()));

  return repositories
    .filter(
      (repository) =>
        !repository.fork &&
        !repository.archived &&
        !repository.disabled &&
        !excluded.has(repository.repository.toLowerCase())
    )
    .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
}

export function formatRepositoryName(repository: string) {
  if (repository.toLowerCase() === "phpvm") {
    return "phpvm";
  }

  const acronyms = new Set(["api", "cli", "css", "html", "http", "php", "sdk", "sql", "ui", "url"]);

  return repository
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => (acronyms.has(part.toLowerCase()) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function cleanGitHubDescription(description: string) {
  return description.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function extractReadmeExcerpt(markdown: string, limit = 3) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[`*_~>|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  return text
    .split(/\n\s*\n|\n(?=[A-Z])/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(
      (paragraph) =>
        paragraph.length >= 45 &&
        !paragraph.toLowerCase().startsWith("license") &&
        !/^\[!(?:warning|caution|note|important|tip)\]/i.test(paragraph)
    )
    .slice(0, limit)
    .map((paragraph) => (paragraph.length > 420 ? `${paragraph.slice(0, 417).trimEnd()}…` : paragraph));
}

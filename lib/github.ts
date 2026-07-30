import fallbackData from "@/data/github.generated.json";
import { profilePolicy } from "@/data/profile-policy";
import {
  cleanGitHubDescription,
  extractReadmeExcerpt,
  formatRepositoryName,
  githubSnapshotSchema,
  selectFeaturedRepositories,
  type GitHubProject,
  type GitHubSnapshot
} from "@/lib/github-model";

type GitHubUserResponse = {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  html_url: string;
  followers: number;
  public_repos: number;
};

type GitHubRepositoryResponse = {
  name: string;
  description: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  homepage: string | null;
  html_url: string;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
};

type GitHubFetchOptions = {
  token?: string;
  now?: Date;
  fetcher?: typeof fetch;
};

export const fallbackGitHubSnapshot = githubSnapshotSchema.parse(fallbackData);

export function getStaticGitHubSnapshot() {
  return fallbackGitHubSnapshot;
}

function githubHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function requestJson<T>(url: string, options: GitHubFetchOptions): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const init: RequestInit = {
    headers: githubHeaders(options.token)
  };
  const response = await fetcher(url, init);

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

async function requestReadme(repository: string, options: GitHubFetchOptions) {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    `https://api.github.com/repos/${profilePolicy.githubUsername}/${encodeURIComponent(repository)}/readme`,
    {
      headers: {
        ...githubHeaders(options.token),
        Accept: "application/vnd.github.raw+json"
      }
    }
  );

  return response.ok ? response.text() : "";
}

export async function fetchGitHubSnapshot(options: GitHubFetchOptions = {}): Promise<GitHubSnapshot> {
  const username = profilePolicy.githubUsername;
  const user = await requestJson<GitHubUserResponse>(`https://api.github.com/users/${username}`, options);
  const repositories: GitHubRepositoryResponse[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const pageItems = await requestJson<GitHubRepositoryResponse[]>(
      `https://api.github.com/users/${username}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`,
      options
    );
    repositories.push(...pageItems);

    if (pageItems.length < 100) {
      break;
    }
  }

  const candidates = repositories.map<GitHubProject & Pick<GitHubRepositoryResponse, "fork" | "archived" | "disabled">>(
    (repository) => ({
      repository: repository.name,
      name: formatRepositoryName(repository.name),
      description: repository.description?.trim()
        ? cleanGitHubDescription(repository.description)
        : `${formatRepositoryName(repository.name)} open-source project.`,
      topics: repository.topics ?? [],
      primaryLanguage: repository.language,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      ...(repository.homepage?.trim() ? { homepage: repository.homepage } : {}),
      repositoryUrl: repository.html_url,
      updatedAt: repository.updated_at,
      readmeExcerpt: [],
      fork: repository.fork,
      archived: repository.archived,
      disabled: repository.disabled
    })
  );

  const featured = selectFeaturedRepositories(
    candidates,
    profilePolicy.featuredRepositoryCount,
    profilePolicy.excludedRepositories
  );
  const projects = await Promise.all(
    featured.map(async (project) => ({
      ...project,
      readmeExcerpt: extractReadmeExcerpt(await requestReadme(project.repository, options))
    }))
  );

  return githubSnapshotSchema.parse({
    username: user.login,
    name: user.name,
    company: user.company,
    location: user.location,
    bio: user.bio,
    profileUrl: user.html_url,
    followers: user.followers,
    publicRepositories: user.public_repos,
    syncedAt: (options.now ?? new Date()).toISOString(),
    projects
  });
}

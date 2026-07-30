import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackGitHubSnapshot, fetchGitHubSnapshot, getGitHubSnapshot } from "@/lib/github";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub source adapter", () => {
  it("falls back to the last-known snapshot when GitHub is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));

    const snapshot = await getGitHubSnapshot();

    expect(snapshot.syncedAt).toBe(fallbackGitHubSnapshot.syncedAt);
    expect(snapshot.projects[0].repository).toBe("fetch-php");
  });

  it("fetches owner repositories and README context", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.endsWith("/users/Thavarshan")) {
        return Response.json({
          login: "Thavarshan",
          name: "Jerome Thayananthajothy",
          company: "Sino Lanka Group",
          location: "Colombo, Sri Lanka",
          bio: "Technical lead",
          html_url: "https://github.com/Thavarshan",
          followers: 70,
          public_repos: 1
        });
      }
      if (url.includes("/users/Thavarshan/repos")) {
        return Response.json([
          {
            name: "example-php",
            description: "🚀 Example developer library",
            topics: ["php"],
            language: "PHP",
            stargazers_count: 25,
            forks_count: 2,
            homepage: "",
            html_url: "https://github.com/Thavarshan/example-php",
            updated_at: "2026-07-01T00:00:00.000Z",
            fork: false,
            archived: false,
            disabled: false
          }
        ]);
      }
      if (url.endsWith("/readme")) {
        return new Response("Example PHP provides a detailed and approachable developer workflow for production applications.");
      }
      return new Response("Not found", { status: 404 });
    });

    const snapshot = await fetchGitHubSnapshot({
      fetcher: fetcher as typeof fetch,
      now: new Date("2026-08-01T00:00:00.000Z")
    });

    expect(snapshot.projects[0]).toMatchObject({
      name: "Example PHP",
      description: "Example developer library",
      stars: 25
    });
    expect(snapshot.projects[0].readmeExcerpt[0]).toContain("approachable developer workflow");
  });
});

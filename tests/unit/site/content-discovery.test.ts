import { describe, expect, it, vi } from "vitest";
vi.mock("../../../src/features/insights/insights.node", () => ({
  getAllInsights: () => [
    { slug: "new-engineering-note", title: "New & useful", description: "A supported lesson", publishedAt: "2026-09-01", relatedProjects: [] },
    { slug: "refreshed-older-note", title: "Older", description: "Updated evidence", publishedAt: "2026-07-30", updatedAt: "2026-10-10", relatedProjects: [] }
  ]
}));
import sitemap from "../../../src/app/sitemap";
import { GET } from "../../../src/app/feed.xml/route";
import { site } from "../../../src/features/profile/site";

describe("publishing and refresh discovery", () => {
  it("automatically includes published articles and uses the latest modification for the collection", () => {
    const pages = sitemap();
    expect(pages.filter((page) => page.url === `${site.url}/insights/new-engineering-note`)).toHaveLength(1);
    expect(pages.find((page) => page.url === `${site.url}/insights`)?.lastModified).toBe("2026-10-10");
    expect(pages.find((page) => page.url.endsWith("/refreshed-older-note"))?.lastModified).toBe("2026-10-10");
  });
  it("refreshes RSS build date while preserving original article publication dates", async () => {
    const xml = await GET().text();
    expect(xml).toContain(`${site.url}/insights/new-engineering-note`);
    expect(xml).toContain("New &amp; useful");
    expect(xml).toContain(`<lastBuildDate>${new Date("2026-10-10").toUTCString()}</lastBuildDate>`);
    expect(xml).toContain(`<pubDate>${new Date("2026-07-30").toUTCString()}</pubDate>`);
  });
});

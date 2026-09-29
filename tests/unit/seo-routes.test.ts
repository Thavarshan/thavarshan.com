import { describe, expect, it } from "vitest";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { site } from "../../data/site";

describe("SEO routes", () => {
  it("publishes one canonical sitemap from robots metadata", () => {
    const metadata = robots();
    expect(metadata.sitemap).toBe(`${site.url}/sitemap.xml`);
    expect(metadata.host).toBe(site.url);
  });

  it("keeps sitemap URLs on the canonical production origin and unique", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);

    for (const url of urls) {
      expect(new URL(url).origin).toBe(new URL(site.url).origin);
      expect(url).not.toContain("netlify.app");
    }
  });
});

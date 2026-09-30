import { describe, expect, it } from "vitest";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { site } from "../../src/data/site";
import { tools } from "../../src/lib/tools/registry";

describe("SEO routes", () => {
  it("publishes one canonical sitemap from robots metadata", () => {
    const metadata = robots();
    expect(metadata.sitemap).toBe(`${site.url}/sitemap.xml`);
    expect(metadata.host).toBe(site.url);
  });

  it("lists the tools index and every tool page exactly once", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(`${site.url}/tools`);
    for (const tool of tools) expect(urls.filter((url) => url === `${site.url}/tools/${tool.slug}`)).toHaveLength(1);
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

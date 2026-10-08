import { describe, expect, it } from "vitest";
import { canonicalOrigin, checkDuplicates, checkPage, checkSitemap, maxAuditPages, type SeoPage } from "../../../automation/seo/rules";

const validPage = (url = canonicalOrigin): SeoPage => ({
  url,
  status: 200,
  contentType: "text/html; charset=utf-8",
  headerRobots: "",
  titles: [`Title for ${url}`],
  descriptions: ["Evidence-backed engineering work."],
  canonicals: [url],
  robots: ["index, follow"],
  headings: ["Engineering work"],
  social: {
    "og:title": ["Title"],
    "og:description": ["Description"],
    "og:type": ["website"],
    "og:url": [url],
    "og:image": ["https://thavarshan.com/image.png"],
    "twitter:card": ["summary_large_image"],
    "twitter:title": ["Title"],
    "twitter:description": ["Description"],
    "twitter:image": ["https://thavarshan.com/image.png"]
  },
  structuredData: ['{"@context":"https://schema.org","@type":"Person"}'],
  links: ["/projects"]
});

describe("rendered SEO audit rules", () => {
  it("accepts a crawler-readable page", () => expect(checkPage(validPage())).toEqual([]));
  it("identifies missing metadata and unexpected redirects by URL and rule", () => {
    const page = { ...validPage(), status: 301, titles: [], descriptions: [], canonicals: [], headings: [], social: {}, links: [] };
    const failures = checkPage(page);
    expect(failures.map((item) => item.rule)).toEqual(
      expect.arrayContaining(["http-status", "title", "description", "canonical", "h1", "social:og:image", "crawlable-links"])
    );
    expect(failures.every((item) => item.url === canonicalOrigin)).toBe(true);
  });
  it.each(["noindex", "NoIndex, follow", "none"])("rejects %s in HTTP robots headers", (headerRobots) => {
    expect(checkPage({ ...validPage(), headerRobots }).map((item) => item.rule)).toContain("indexability");
  });
  it("rejects accidental noindex in HTML and invalid JSON-LD", () => {
    expect(checkPage({ ...validPage(), robots: ["noindex"], structuredData: ["{bad"] }).map((item) => item.rule)).toEqual(
      expect.arrayContaining(["indexability", "structured-data"])
    );
  });
  it("rejects a canonical or Open Graph URL inherited from another page", () => {
    const page = validPage(`${canonicalOrigin}/projects`);
    page.canonicals = [canonicalOrigin];
    page.social["og:url"] = [canonicalOrigin];
    expect(checkPage(page).map((item) => item.rule)).toEqual(expect.arrayContaining(["canonical", "social:canonical-url"]));
  });
  it("rejects duplicate metadata even when one copy is correct", () => {
    const page = validPage();
    page.canonicals.push(page.url);
    page.titles.push("Other title");
    expect(checkPage(page).map((item) => item.rule)).toEqual(expect.arrayContaining(["canonical", "title"]));
  });
  it("detects duplicate titles and canonicals across pages", () => {
    const home = validPage();
    const projects = { ...validPage(`${canonicalOrigin}/projects`), titles: home.titles, canonicals: home.canonicals };
    expect(checkDuplicates([home, projects]).map((item) => item.rule)).toEqual(["duplicate-title", "duplicate-canonical"]);
  });
  it("refuses malformed, off-origin, duplicate and over-budget sitemap inputs", () => {
    const urls = [canonicalOrigin, canonicalOrigin, "https://preview.netlify.app/", `${canonicalOrigin}/?q=tracking`, "not-a-url"];
    expect(checkSitemap(urls).map((item) => item.rule)).toEqual(["sitemap-duplicate", "sitemap-origin", "sitemap-origin", "sitemap-origin"]);
    expect(checkSitemap([])[0].rule).toBe("crawl-budget");
    expect(checkSitemap(Array.from({ length: maxAuditPages + 1 }, (_, index) => `${canonicalOrigin}/${index}`))[0].rule).toBe("crawl-budget");
    expect(checkSitemap([canonicalOrigin, `${canonicalOrigin}/projects`])).toEqual([]);
  });
});

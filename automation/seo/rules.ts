export const canonicalOrigin = "https://thavarshan.com";
export const maxAuditPages = 60;

export interface SeoPage {
  url: string;
  status: number;
  contentType: string;
  headerRobots: string;
  titles: string[];
  descriptions: string[];
  canonicals: string[];
  robots: string[];
  headings: string[];
  social: Record<string, string[]>;
  structuredData: string[];
  links: string[];
}

export interface SeoFailure {
  url: string;
  rule: string;
  detail: string;
}

/** These rules consume HTTP responses and raw HTML, not route metadata objects. */
export function checkPage(page: SeoPage): SeoFailure[] {
  const failures: SeoFailure[] = [];
  const require = (condition: boolean, rule: string, detail: string) => {
    if (!condition) failures.push({ url: page.url, rule, detail });
  };
  require(page.status === 200, "http-status", `Expected 200 without a redirect; received ${page.status}`);
  require(page.contentType.includes("text/html"), "content-type", `Expected HTML; received ${page.contentType}`);
  require(page.titles.length === 1 && Boolean(page.titles[0]), "title", "Expected exactly one nonempty title");
  require(page.descriptions.length === 1 && Boolean(page.descriptions[0]), "description", "Expected exactly one nonempty description");
  require(page.canonicals.length === 1 && page.canonicals[0] === page.url, "canonical", `Expected one canonical matching ${page.url}`);
  require(page.headings.length === 1 && Boolean(page.headings[0]), "h1", "Expected exactly one nonempty H1");
  require(!/\b(noindex|none)\b/i.test([...page.robots, page.headerRobots].join(",")), "indexability", "A sitemap page is marked noindex");
  require(!/\b(nofollow|none)\b/i.test([...page.robots, page.headerRobots].join(",")), "followability", "A sitemap page is marked nofollow");
  for (const key of ["og:title", "og:description", "og:type", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    require(page.social[key]?.length === 1 && Boolean(page.social[key][0]), `social:${key}`, `Expected one nonempty ${key}`);
  }
  // The privacy page inherits the site's sharing metadata and intentionally has no schema entity.
  if (new URL(page.url).pathname !== "/privacy") {
    require(page.social["og:url"]?.[0] === page.url, "social:canonical-url", "Open Graph URL must match the page canonical");
    require(page.structuredData.length > 0, "structured-data", "Expected JSON-LD on a content page");
  }
  for (const json of page.structuredData) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      require(Boolean(
        parsed && typeof parsed === "object" && parsed["@context"] === "https://schema.org" && (parsed["@type"] || parsed["@graph"])
      ), "structured-data", "Expected a schema.org entity or graph");
    } catch {
      require(false, "structured-data", "JSON-LD is not valid JSON");
    }
  }
  require(page.links.some((link) => link.startsWith("/") || link.startsWith(canonicalOrigin)), "crawlable-links", "Expected a crawlable internal anchor");
  return failures;
}

export function checkSitemap(urls: string[]): SeoFailure[] {
  const failures: SeoFailure[] = [];
  if (!urls.length || urls.length > maxAuditPages) {
    failures.push({ url: `${canonicalOrigin}/sitemap.xml`, rule: "crawl-budget", detail: `Expected 1–${maxAuditPages} sitemap URLs; received ${urls.length}` });
  }
  const seen = new Set<string>();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== canonicalOrigin || parsed.pathname.startsWith("//") || parsed.search || parsed.hash) throw new Error("noncanonical");
    } catch {
      failures.push({ url, rule: "sitemap-origin", detail: "Sitemap URL must use the production origin with no query or fragment" });
    }
    if (seen.has(url)) failures.push({ url, rule: "sitemap-duplicate", detail: "Sitemap URL appears more than once" });
    seen.add(url);
  }
  return failures;
}

export function checkDuplicates(pages: SeoPage[]): SeoFailure[] {
  const failures: SeoFailure[] = [];
  for (const [field, rule] of [
    ["titles", "duplicate-title"],
    ["canonicals", "duplicate-canonical"]
  ] as const) {
    const seen = new Map<string, string>();
    for (const page of pages) {
      const value = page[field][0];
      if (!value) continue;
      const previous = seen.get(value);
      if (previous) failures.push({ url: page.url, rule, detail: `Same value as ${previous}: ${value}` });
      seen.set(value, page.url);
    }
  }
  return failures;
}

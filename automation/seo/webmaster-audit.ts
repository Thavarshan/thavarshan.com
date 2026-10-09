import { mkdir, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { isPathAllowed, parseRobots } from "../jobs/robots";
import { canonicalOrigin, checkDuplicates, checkPage, checkSitemap, maxAuditPages, type SeoFailure, type SeoPage } from "./rules";

export const webmasterLimits = { pages: maxAuditPages, requestTimeoutMs: 10_000, responseBytes: 2 * 1024 * 1024, redirects: 0 };
const homepageUrl = `${canonicalOrigin}/`;

export function sitemapUrls(xml: string): string[] {
  const document = new JSDOM(xml, { contentType: "application/xml" }).window.document;
  if (document.documentElement.localName !== "urlset" || document.documentElement.namespaceURI !== "http://www.sitemaps.org/schemas/sitemap/0.9") {
    throw new Error("Expected a sitemap.org urlset");
  }
  return Array.from(document.documentElement.children, (entry) => {
    const locations = Array.from(entry.children).filter((node) => node.localName === "loc");
    if (
      entry.localName !== "url" ||
      entry.namespaceURI !== document.documentElement.namespaceURI ||
      locations.length !== 1 ||
      locations[0].namespaceURI !== entry.namespaceURI
    )
      throw new Error("Expected exactly one loc per sitemap url");
    return locations[0].textContent?.trim() ?? "";
  });
}

export function homepageVerification(html: string) {
  const document = new JSDOM(html).window.document;
  const read = (name: string) => {
    const tags = Array.from(document.head.querySelectorAll(`meta[name="${name}"]`));
    if (tags.length === 0) return "absent" as const;
    return tags.length === 1 && /^[A-Za-z0-9_-]{1,512}$/.test(tags[0].getAttribute("content") ?? "") ? ("present" as const) : ("invalid" as const);
  };
  return { google: read("google-site-verification"), bing: read("msvalidate.01"), accountOwnership: "unknown" as const };
}

export function crawlerFailures(robotsText: string, urls: string[]): SeoFailure[] {
  const failures: SeoFailure[] = [];
  const declarations = robotsText
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim());
  if (declarations.length !== 1 || declarations[0] !== `${canonicalOrigin}/sitemap.xml`) {
    failures.push({ url: `${canonicalOrigin}/robots.txt`, rule: "robots-sitemap", detail: "Expected exactly one canonical sitemap declaration" });
  }
  if (!/^user-agent\s*:\s*\*\s*$/im.test(robotsText)) {
    failures.push({ url: `${canonicalOrigin}/robots.txt`, rule: "robots-policy", detail: "Expected an explicit general-crawler policy" });
  }
  for (const agent of ["*", "Googlebot", "bingbot"]) {
    const policy = parseRobots(robotsText, agent);
    for (const url of urls) {
      if (!isPathAllowed(policy, new URL(url).pathname)) failures.push({ url, rule: "robots-blocked", detail: `Sitemap page blocked for ${agent}` });
    }
    for (const path of ["/api/private", "/profile-imports/private"]) {
      if (isPathAllowed(policy, path))
        failures.push({
          url: `${canonicalOrigin}${path}`,
          rule: "robots-private-path",
          detail: `Expected exclusion for ${agent}; robots is not access control`
        });
    }
  }
  return failures;
}

function pageFacts(url: string, response: Response, html: string): SeoPage {
  // No scripts or subresources are executed; inspect exactly what a crawler receives.
  const document = new JSDOM(html).window.document;
  const text = (selector: string) => Array.from(document.querySelectorAll(selector), (node) => node.textContent?.trim() ?? "");
  const content = (selector: string) => Array.from(document.querySelectorAll(selector), (node) => node.getAttribute("content")?.trim() ?? "");
  const social: Record<string, string[]> = {};
  for (const node of document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')) {
    const key = node.getAttribute("property") ?? node.getAttribute("name") ?? "";
    social[key] = [...(social[key] ?? []), node.getAttribute("content")?.trim() ?? ""];
  }
  return {
    url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    headerRobots: response.headers.get("x-robots-tag") ?? "",
    titles: text("title"),
    descriptions: content('meta[name="description"]'),
    canonicals: Array.from(document.querySelectorAll('link[rel="canonical"]'), (node) => node.getAttribute("href") ?? ""),
    robots: content('meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"]'),
    headings: text("h1"),
    social,
    structuredData: text('script[type="application/ld+json"]'),
    links: Array.from(document.querySelectorAll("a[href]"), (node) => node.getAttribute("href") ?? "")
  };
}

async function boundedText(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > webmasterLimits.responseBytes) throw new Error("Response exceeds the webmaster audit size limit");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function auditWebmaster(fetcher: typeof fetch = fetch) {
  const failures: SeoFailure[] = [];
  const pages: SeoPage[] = [];
  let verification: ReturnType<typeof homepageVerification> | null = null;
  const add = (url: string, rule: string, detail: string) => failures.push({ url, rule, detail });
  const request = async (url: string) => {
    if (new URL(url).origin !== canonicalOrigin) throw new Error("Only the canonical production origin may be audited");
    const response = await fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(webmasterLimits.requestTimeoutMs),
      headers: { "cache-control": "no-cache" }
    });
    return { response, text: await boundedText(response) };
  };
  let robotsText = "";
  let urls: string[] = [];
  for (const file of ["robots.txt", "sitemap.xml"]) {
    const url = `${canonicalOrigin}/${file}`;
    try {
      const { response, text } = await request(url);
      if (response.status !== 200) {
        add(url, "http-status", `Expected 200 without redirect; received ${response.status}`);
        continue;
      }
      if (file === "robots.txt") robotsText = text;
      else {
        urls = sitemapUrls(text);
        failures.push(...checkSitemap(urls));
      }
    } catch {
      // Network errors, parser diagnostics and response bodies can contain ownership values.
      add(url, "request-or-parse", "Unable to read a valid, bounded response");
    }
  }
  // Never crawl an invalid or untrusted sitemap. Even its failure URLs must not leak query strings.
  if (checkSitemap(urls).length === 0) {
    failures.push(...crawlerFailures(robotsText, urls));
    if (!urls.some((url) => new URL(url).pathname === "/")) add(homepageUrl, "sitemap-home", "Homepage is absent from sitemap");
    for (const url of urls) {
      try {
        const { response, text } = await request(url);
        const page = pageFacts(url, response, text);
        pages.push(page);
        failures.push(...checkPage(page));
        if (new URL(url).pathname === "/") {
          verification = homepageVerification(text);
          for (const engine of ["google", "bing"] as const) {
            if (verification[engine] === "invalid") add(homepageUrl, "verification-tag", `Expected one valid ${engine} ownership tag in head`);
          }
        }
      } catch {
        add(url, "request-or-parse", "Unable to read a valid, bounded page response");
      }
    }
    failures.push(...checkDuplicates(pages));
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: canonicalOrigin,
    limits: webmasterLimits,
    status: failures.length ? "failed" : "passed",
    sitemapPages: urls.length,
    auditedPages: pages.length,
    verification,
    indexing: "unknown",
    searchPerformance: "unavailable",
    failures: failures.map((failure) => ({ ...failure, url: safeFailureUrl(failure.url), detail: safeDetail(failure) })),
    notes: [
      "Technical eligibility and tag presence do not prove account verification, indexing or rankings.",
      "Use owner-authenticated Search Console/Bing reports for indexed pages, impressions, clicks, CTR and average position."
    ]
  };
}

// Reports contain public URL/rule identifiers, never response HTML or verification values.
function safeFailureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === canonicalOrigin ? `${url.origin}${url.pathname}` : "[noncanonical sitemap URL]";
  } catch {
    return "[invalid sitemap URL]";
  }
}
function safeDetail(failure: SeoFailure) {
  // Existing SEO rules may echo canonical or duplicate metadata from untrusted responses.
  if (["canonical", "duplicate-title", "duplicate-canonical", "content-type"].includes(failure.rule)) return "Page does not satisfy the canonical SEO rule";
  return failure.detail;
}

async function main() {
  const report = await auditWebmaster();
  await mkdir("test-results/webmaster", { recursive: true });
  await writeFile("test-results/webmaster/audit.json", JSON.stringify(report, null, 2) + "\n");
  const summary = `Webmaster audit: ${report.status}\nSitemap pages: ${report.sitemapPages}; audited: ${report.auditedPages}\nGoogle tag: ${report.verification?.google ?? "unknown"}; Bing tag: ${report.verification?.bing ?? "unknown"}\nAccount ownership/indexing: unknown; search performance: unavailable\n`;
  console.log(summary);
  for (const failure of report.failures) console.error(`${failure.url} [${failure.rule}] ${failure.detail}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Production webmaster baseline\n\n${summary.replaceAll("\n", "  \n")}\n`);
  }
  if (report.failures.length) process.exitCode = 1;
}
if (import.meta.url === `file://${process.argv[1]}`) await main();

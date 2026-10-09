import { describe, expect, it, vi } from "vitest";
import { auditWebmaster, crawlerFailures, homepageVerification, sitemapUrls, webmasterLimits } from "../../../automation/seo/webmaster-audit";
import { canonicalOrigin } from "../../../automation/seo/rules";
import { verificationMetadata } from "../../../src/features/profile/verification";

const robots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /profile-imports/\nSitemap: ${canonicalOrigin}/sitemap.xml\n`;
const xml = (urls = [canonicalOrigin]) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
const html = `<html><head><title>Jerome engineering</title><meta name="description" content="Engineering evidence"><link rel="canonical" href="${canonicalOrigin}">
${["og:title", "og:description", "og:type", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"].map((key) => `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${key === "og:url" ? canonicalOrigin : "value"}">`).join("")}
<meta name="google-site-verification" content="fixture-google"><meta name="msvalidate.01" content="fixture-bing">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person"}</script></head><body><h1>Jerome</h1><a href="/projects">Projects</a></body></html>`;
const response = (text: string, status = 200, contentType = "text/html", headers: Record<string, string> = {}) =>
  new Response(text, { status, headers: { "content-type": contentType, ...headers } });
const fetcher = (overrides: Record<string, () => Response> = {}) =>
  vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (overrides[url]) return overrides[url]();
    if (url.endsWith("/robots.txt")) return response(robots, 200, "text/plain");
    if (url.endsWith("/sitemap.xml")) return response(xml(), 200, "application/xml");
    return response(html);
  });

describe("webmaster ownership metadata", () => {
  it("omits absent or whitespace-only values", () => expect(verificationMetadata({ GOOGLE_SITE_VERIFICATION: " " })).toEqual({}));
  it("uses the correct engine meta names and trimmed values", () => {
    expect(verificationMetadata({ GOOGLE_SITE_VERIFICATION: " google_-123 ", BING_SITE_VERIFICATION: "ABC123" })).toEqual({
      google: "google_-123",
      other: { "msvalidate.01": ["ABC123"] }
    });
  });
  it.each(["<meta secret-value>", "token secret-value", "x".repeat(513)])("rejects invalid values without including them in the error", (value) => {
    try {
      verificationMetadata({ GOOGLE_SITE_VERIFICATION: value });
      throw new Error("Expected validation failure");
    } catch (error) {
      expect((error as Error).message).toBe("GOOGLE_SITE_VERIFICATION must contain only the meta tag's ownership value");
    }
  });
  it("reports presence but never claims ownership or retains values", () => {
    expect(homepageVerification(html)).toEqual({ google: "present", bing: "present", accountOwnership: "unknown" });
    expect(homepageVerification("<html></html>").google).toBe("absent");
    expect(homepageVerification(html.replace('content="fixture-google"', 'content=""')).google).toBe("invalid");
    expect(homepageVerification(html.replace("</head>", '<meta name="google-site-verification" content="other"></head>')).google).toBe("invalid");
  });
});

describe("production webmaster audit", () => {
  it.each(["/api/private", "/profile-imports/private", "/docs/Jerome-Resume.pdf", "/_next/static/file.js"])(
    "refuses excluded sitemap path %s before crawling",
    async (path) => {
      const get = fetcher({ [`${canonicalOrigin}/sitemap.xml`]: () => response(xml([`${canonicalOrigin}${path}`])) });
      const report = await auditWebmaster(get);
      expect(report.status).toBe("failed");
      expect(get).toHaveBeenCalledTimes(2);
      expect(report.failures.some((failure) => failure.rule === "sitemap-private-path")).toBe(true);
    }
  );
  it("audits raw responses without redirects and reports only safe aggregate facts", async () => {
    const get = fetcher();
    const report = await auditWebmaster(get);
    expect(report.status).toBe("passed");
    expect(report.auditedPages).toBe(1);
    expect(report.verification?.google).toBe("present");
    expect(report.indexing).toBe("unknown");
    expect(JSON.stringify(report)).not.toContain("fixture-google");
    expect(JSON.stringify(report)).not.toContain(html);
    expect(get).toHaveBeenCalledTimes(3);
    for (const [, options] of get.mock.calls) expect(options).toMatchObject({ redirect: "manual" });
  });
  it.each([
    [canonicalOrigin, canonicalOrigin],
    ["https://deploy-preview-1--thavarshan.netlify.app/"],
    [`${canonicalOrigin}/?private=value`],
    Array.from({ length: 61 }, (_, i) => `${canonicalOrigin}/${i}`)
  ])("refuses invalid sitemap input before any page request", async (...args) => {
    const urls = args as string[];
    const get = fetcher({ [`${canonicalOrigin}/sitemap.xml`]: () => response(xml(urls)) });
    const report = await auditWebmaster(get);
    expect(report.status).toBe("failed");
    expect(get).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(report)).not.toContain("private=value");
  });
  it("rejects malformed XML, a sitemap index and duplicate locs", () => {
    expect(() => sitemapUrls("<bad")).toThrow();
    expect(() => sitemapUrls('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')).toThrow();
    expect(() => sitemapUrls(xml().replace("</loc>", "</loc><loc>other</loc>"))).toThrow();
  });
  it("handles independent robots/sitemap failures without losing the report", async () => {
    const get = fetcher({
      [`${canonicalOrigin}/robots.txt`]: () => {
        throw new Error("secret-network-error");
      }
    });
    const report = await auditWebmaster(get);
    expect(report.status).toBe("failed");
    expect(report.auditedPages).toBe(1);
    expect(JSON.stringify(report)).not.toContain("secret-network-error");
  });
  it("rejects redirecting or noindex pages", async () => {
    for (const override of [
      () => response(html, 301, "text/html", { location: "https://elsewhere.example" }),
      () => response(html, 200, "text/html", { "x-robots-tag": "noindex" })
    ]) {
      const report = await auditWebmaster(fetcher({ [canonicalOrigin]: override }));
      expect(report.status).toBe("failed");
      expect(report.failures.some((failure) => ["http-status", "indexability"].includes(failure.rule))).toBe(true);
    }
  });
  it("detects Googlebot-specific disallow while respecting longer Allow rules", () => {
    expect(crawlerFailures(`${robots}User-agent: Googlebot\nDisallow: /\n`, [canonicalOrigin]).some((failure) => failure.rule === "robots-blocked")).toBe(true);
    expect(crawlerFailures(robots.replace("Allow: /", "Disallow: /projects/\nAllow: /projects/fetch-php"), [`${canonicalOrigin}/projects/fetch-php`])).toEqual(
      []
    );
    expect(crawlerFailures(robots.replace("Sitemap:", "# Sitemap:"), [canonicalOrigin]).some((failure) => failure.rule === "robots-sitemap")).toBe(true);
  });
  it("fails on oversized responses without retaining their contents", async () => {
    const report = await auditWebmaster(fetcher({ [`${canonicalOrigin}/sitemap.xml`]: () => response("x".repeat(webmasterLimits.responseBytes + 1)) }));
    expect(report.status).toBe("failed");
    expect(report.auditedPages).toBe(0);
  });
});

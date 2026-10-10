import { auditLinkGraph, maxCrawlDepth } from "../../automation/seo/link-graph";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { canonicalOrigin, checkDuplicates, checkPage, checkSitemap, maxAuditPages, type SeoFailure, type SeoPage } from "../../automation/seo/rules";

import { auditLifecycle } from "../../automation/seo/lifecycle-audit";
import { checkLifecycleLinks, lifecycleSchema, parseContentRedirects } from "../../automation/seo/lifecycle";

test("exported pages satisfy rendered SEO and HTTP invariants", async ({ page, request }, testInfo) => {
  const failures: SeoFailure[] = [];
  const pages: SeoPage[] = [];
  const addFailure = (url: string, rule: string, detail: string) => failures.push({ url, rule, detail });
  try {
    const lifecycle = lifecycleSchema.parse(JSON.parse(await readFile("data/url-lifecycle.json", "utf8")));
    const redirects = parseContentRedirects(await readFile("out/_redirects", "utf8"));
    failures.push(...(await auditLifecycle()));
    for (const rule of redirects) {
      const response = await request.get(rule.from, { maxRedirects: 0, timeout: 10_000 });
      const actual = response.headers()["location"];
      if (response.status() !== rule.status || !actual || new URL(actual, canonicalOrigin).href !== new URL(rule.to, canonicalOrigin).href) {
        addFailure(`${canonicalOrigin}${rule.from}`, "content-redirect-http", "Expected the configured permanent redirect to its final target");
      }
    }
    for (const retired of lifecycle.retired) {
      const response = await request.get(retired.path, { maxRedirects: 0, timeout: 10_000 });
      if (response.status() !== retired.status) addFailure(`${canonicalOrigin}${retired.path}`, "retired-http", "Retired page must return its declared 404");
    }
    const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0, timeout: 10_000 });
    if (sitemap.status() !== 200) addFailure(`${canonicalOrigin}/sitemap.xml`, "http-status", `Received ${sitemap.status()}`);
    const urls = await page.evaluate(
      (xml) => {
        const document = new DOMParser().parseFromString(xml, "application/xml");
        if (document.querySelector("parsererror")) return [];
        return Array.from(document.querySelectorAll("url > loc"), (node) => node.textContent?.trim() ?? "");
      },
      await sitemap.text()
    );
    const sitemapFailures = checkSitemap(urls);
    failures.push(...sitemapFailures);
    const robots = await request.get("/robots.txt", { maxRedirects: 0, timeout: 10_000 });
    const robotsText = await robots.text();
    if (robots.status() !== 200 || !robotsText.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) {
      addFailure(`${canonicalOrigin}/robots.txt`, "robots-sitemap", "Expected 200 and the canonical sitemap declaration");
    }
    // Reject malformed/off-origin input before issuing requests, rather than truncating silently.
    if (sitemapFailures.length === 0) {
      for (const url of urls) {
        const path = new URL(url).pathname;
        try {
          const response = await request.get(path, { maxRedirects: 0, timeout: 10_000 });
          const html = await response.text();
          // Parse the initial response with scripts and network subresources disabled. Hydration
          // cannot repair missing metadata and make this crawler-facing audit falsely pass.
          const facts = await page.evaluate((source) => {
            const document = new DOMParser().parseFromString(source, "text/html");
            const text = (selector: string) => Array.from(document.querySelectorAll(selector), (node) => node.textContent?.trim() ?? "");
            const content = (selector: string) => Array.from(document.querySelectorAll(selector), (node) => node.getAttribute("content")?.trim() ?? "");
            const social: Record<string, string[]> = {};
            for (const node of document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')) {
              const key = node.getAttribute("property") ?? node.getAttribute("name") ?? "";
              social[key] = [...(social[key] ?? []), node.getAttribute("content")?.trim() ?? ""];
            }
            return {
              titles: text("title"),
              descriptions: content('meta[name="description"]'),
              canonicals: Array.from(document.querySelectorAll('link[rel="canonical"]'), (node) => node.getAttribute("href") ?? ""),
              robots: content('meta[name="robots"], meta[name="googlebot"]'),
              headings: text("h1"),
              social,
              structuredData: text('script[type="application/ld+json"]'),
              links: Array.from(document.querySelectorAll("a[href]"), (node) => node.getAttribute("href") ?? "")
            };
          }, html);
          const snapshot: SeoPage = {
            url,
            status: response.status(),
            contentType: response.headers()["content-type"] ?? "",
            headerRobots: response.headers()["x-robots-tag"] ?? "",
            ...facts
          };
          pages.push(snapshot);
          failures.push(...checkPage(snapshot));
          // A sitemap URL may not be blocked for the general crawler in robots.txt.
          // Current generated policy has one User-agent:* group and literal prefix rules.
          const disallows = [...robotsText.matchAll(/^Disallow:\s*(\S+)\s*$/gim)].map((match) => match[1]);
          if (disallows.some((prefix) => path.startsWith(prefix))) addFailure(url, "robots-blocked", "Sitemap page is blocked by robots.txt");
        } catch (error) {
          addFailure(url, "request", error instanceof Error ? error.message : String(error));
        }
      }
      failures.push(...checkDuplicates(pages), ...checkLifecycleLinks(pages, redirects, lifecycle.retired));
      for (const path of ["/", "/cv", "/projects", "/insights", "/tools", "/privacy"]) {
        if (!pages.some((item) => new URL(item.url).pathname === path))
          addFailure(`${canonicalOrigin}${path}`, "sitemap-coverage", "Required public page is absent from the sitemap");
      }
      for (const prefix of ["/projects/", "/insights/", "/tools/"]) {
        if (!pages.some((item) => new URL(item.url).pathname.startsWith(prefix)))
          addFailure(`${canonicalOrigin}${prefix}`, "sitemap-coverage", "No detail page audited for this page class");
      }
      const targets = new Set(
        pages
          .flatMap((item) => item.links.map((link) => ({ link, source: item.url })))
          .flatMap(({ link, source }) => {
            try {
              const parsed = new URL(link, source);
              return parsed.origin === canonicalOrigin && parsed.pathname !== new URL(source).pathname ? [parsed.pathname] : [];
            } catch {
              return [];
            }
          })
      );
      if (targets.size > 120) {
        addFailure(canonicalOrigin, "link-budget", "More than 120 unique internal link targets; increase the bound intentionally");
      } else {
        const auditedPaths = new Set(pages.map((item) => new URL(item.url).pathname));
        for (const path of targets) {
          if (auditedPaths.has(path) || path.startsWith("//")) continue;
          try {
            const response = await request.head(path, { maxRedirects: 0, timeout: 10_000 });
            if (response.status() !== 200) addFailure(`${canonicalOrigin}${path}`, "internal-link-status", `Expected 200; received ${response.status()}`);
          } catch (error) {
            addFailure(`${canonicalOrigin}${path}`, "internal-link-request", error instanceof Error ? error.message : String(error));
          }
        }
      }
      for (const item of auditLinkGraph(pages).pages) {
        if (item.depth === null)
          addFailure(`${canonicalOrigin}${item.path}`, "internal-discovery", "No rendered link path from the homepage reaches this sitemap page");
        else if (item.depth > maxCrawlDepth)
          addFailure(`${canonicalOrigin}${item.path}`, "crawl-depth", `Requires ${item.depth} clicks from home; maximum is ${maxCrawlDepth}`);
      }
    }
    const missing = await request.get("/__seo_audit_missing_page__", { maxRedirects: 0, timeout: 10_000 });
    const missingHtml = await missing.text();
    if (missing.status() !== 404) addFailure(`${canonicalOrigin}/__seo_audit_missing_page__`, "not-found-status", `Expected 404; received ${missing.status()}`);
    const missingNoindex = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, "text/html");
      return Array.from(document.querySelectorAll('meta[name="robots"]')).some((node) => /\b(noindex|none)\b/i.test(node.getAttribute("content") ?? ""));
    }, missingHtml);
    if (!missingNoindex) addFailure(`${canonicalOrigin}/__seo_audit_missing_page__`, "not-found-indexability", "Expected noindex on the 404 page");
  } catch (error) {
    addFailure(canonicalOrigin, "audit-runtime", error instanceof Error ? error.message : String(error));
  } finally {
    const report = {
      schemaVersion: 1,
      target: "local-static-export",
      canonicalOrigin,
      generatedAt: new Date().toISOString(),
      limits: { pages: maxAuditPages, internalLinks: 120, requestTimeoutMs: 10_000, redirects: 0 },
      pages,
      linkGraph: auditLinkGraph(pages),
      failures,
      status: failures.length ? "failed" : "passed"
    };
    await mkdir("test-results/seo", { recursive: true });
    const json = JSON.stringify(report, null, 2);
    await writeFile("test-results/seo/audit.json", json);
    await testInfo.attach("rendered-seo-audit", { body: json, contentType: "application/json" });
  }
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});

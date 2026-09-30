// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInventory, diffInventories, type Inventory } from "@automation/structure/routes";

const baseFiles = [
  "index.html", "index.txt", "cv.html", "privacy.html", "insights.html", "tools.html", "404.html", "robots.txt", "sitemap.xml", "feed.xml", "opengraph-image",
  "insights/a.html", "insights/a/opengraph-image", "projects/x.html", "projects/x/opengraph-image", "tools/t.html", "tools/t/opengraph-image",
  "docs/Jerome-Resume.pdf", "images/avatar.jpg", "_next/static/chunk.js", "__next._full.txt", "cv.txt", "insights/a.txt"
];
const expected = (): Inventory => buildInventory(baseFiles);

describe("public URL inventory", () => {
  it("normalises per-item pages to patterns and ignores build internals and RSC payloads", () => {
    const inventory = expected();
    expect(inventory.pages).toEqual(["/", "/404", "/cv", "/insights", "/insights/[slug]", "/privacy", "/projects/[slug]", "/tools", "/tools/[slug]"]);
    expect(inventory.files).toEqual(expect.arrayContaining(["/robots.txt", "/sitemap.xml", "/feed.xml", "/opengraph-image", "/insights/[slug]/opengraph-image"]));
    expect(inventory.assets).toEqual(["/docs/Jerome-Resume.pdf", "/images/avatar.jpg"]);
    expect(JSON.stringify(inventory)).not.toContain("_next");
    expect(JSON.stringify(inventory)).not.toContain("__next");
  });

  it("is unaffected by ordinary content growth (more insights, projects, tools)", () => {
    const grown = buildInventory([...baseFiles, "insights/b.html", "insights/b/opengraph-image", "projects/y.html", "projects/y/opengraph-image", "projects/z.html", "tools/u.html", "tools/u/opengraph-image"]);
    expect(diffInventories(expected(), grown)).toEqual([]);
  });

  it("detects a removed, renamed or added route", () => {
    expect(diffInventories(expected(), buildInventory(baseFiles.filter((file) => file !== "cv.html")))).toContain("missing page: /cv");
    const renamed = buildInventory([...baseFiles.filter((file) => file !== "privacy.html"), "privacy-policy.html"]);
    expect(diffInventories(expected(), renamed)).toEqual(expect.arrayContaining(["missing page: /privacy", "unexpected page: /privacy-policy"]));
    expect(diffInventories(expected(), buildInventory([...baseFiles, "admin.html"]))).toContain("unexpected page: /admin");
  });

  it("detects lost social images, feeds, sitemap and static assets", () => {
    for (const lost of ["sitemap.xml", "feed.xml", "robots.txt", "docs/Jerome-Resume.pdf", "insights/a/opengraph-image"]) {
      expect(diffInventories(expected(), buildInventory(baseFiles.filter((file) => file !== lost))).length, lost).toBeGreaterThan(0);
    }
  });

  it("detects a dynamic route kind that stops producing pages, or a new one appearing", () => {
    const noTools = buildInventory(baseFiles.filter((file) => !file.startsWith("tools/")));
    expect(diffInventories(expected(), noTools)).toContain('dynamic route "tools" produced no pages');
    expect(diffInventories(expected(), buildInventory([...baseFiles, "labs/one.html"]))).toContain("unexpected page: /labs/one");
  });

  it("matches the committed baseline fixture's shape", () => {
    const fixture = JSON.parse(readFileSync("tests/fixtures/structure/routes.json", "utf8")) as Inventory;
    expect(fixture.pages).toContain("/");
    expect(fixture.pages).toEqual(expect.arrayContaining(["/cv", "/projects/[slug]", "/insights/[slug]", "/tools/[slug]", "/privacy"]));
    expect(fixture.files).toEqual(expect.arrayContaining(["/sitemap.xml", "/robots.txt", "/feed.xml", "/indexnow-key.txt", "/_redirects"]));
    expect(fixture.assets).toContain("/docs/Jerome-Resume.pdf");
    expect(Object.keys(fixture.dynamicCounts).sort()).toEqual(["insights", "insights:og", "projects", "projects:og", "tools", "tools:og"]);
  });
});

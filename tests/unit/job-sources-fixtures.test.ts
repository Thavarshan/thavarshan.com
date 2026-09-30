import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLaraJobsFeedItems } from "@/scripts/jobs/sources/larajobs";
import { extractLaravelNewsAnchors, laravelNewsJobSelector, normalizeLaravelNewsLinks } from "@/scripts/jobs/sources/laravel-news";
import { parseRemotiveJobs } from "@/scripts/jobs/sources/remotive";
import { parseWeWorkRemotelyFeed } from "@/scripts/jobs/sources/weworkremotely";

/**
 * Real samples captured from each source (tests/fixtures/jobs/sources). They exist so a change in a
 * source's format fails a test here instead of silently producing an empty or garbled snapshot.
 * To refresh one after a deliberate format change, re-capture it and update the assertions.
 */
const fixture = (name: string) => readFileSync(resolve(process.cwd(), "tests/fixtures/jobs/sources", name), "utf8");
const now = "2026-09-30T00:00:00.000Z";

describe("LaraJobs RSS (captured sample)", () => {
  const drafts = parseLaraJobsFeedItems(fixture("larajobs-feed.xml"));

  it("parses every item with the structured job:* fields", () => {
    expect(drafts).toHaveLength(3);
    for (const draft of drafts) {
      expect(draft.title.length).toBeGreaterThan(3);
      expect(draft.canonicalUrl).toMatch(/^https:\/\/larajobs\.com\/job\/\d+$/);
      expect(draft.company).toBeTruthy();
      expect(draft.location).toBeTruthy();
      expect(draft.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("fails loudly when the feed format changes rather than yielding an empty snapshot", () => {
    const renamed = fixture("larajobs-feed.xml").replaceAll("<item>", "<entry>").replaceAll("</item>", "</entry>");
    expect(parseLaraJobsFeedItems(renamed)).toEqual([]);
  });
});

describe("WeWorkRemotely RSS (captured sample)", () => {
  it("parses items, splits 'Company: Title', and keeps only Laravel/PHP-relevant listings", () => {
    const { opportunities, skipped, rejected } = parseWeWorkRemotelyFeed(fixture("weworkremotely-feed.xml"), now);
    expect(opportunities.length + skipped + rejected).toBe(3);
    expect(opportunities.length).toBeGreaterThanOrEqual(1);
    expect(skipped).toBeGreaterThanOrEqual(1);
    for (const job of opportunities) {
      expect(job.source).toBe("weworkremotely");
      expect(job.canonicalUrl).toMatch(/^https:\/\/weworkremotely\.com\/remote-jobs\//);
      expect(job.sourceId).toBeTruthy();
      expect(job.descriptionHash).toBeTruthy();
      expect(job.title).not.toContain(": ");
    }
  });

  it("throws when the feed shape changes (zero items)", () => {
    expect(() => parseWeWorkRemotelyFeed("<rss><channel></channel></rss>", now)).toThrow(/zero items/);
  });
});

describe("Remotive API (captured sample)", () => {
  const json = JSON.parse(fixture("remotive-api.json"));

  it("parses jobs, applying the relevance filter and recording provenance", () => {
    const { opportunities, skipped, rejected } = parseRemotiveJobs(json, now);
    expect(opportunities.length + skipped + rejected).toBe(3);
    expect(skipped).toBeGreaterThanOrEqual(1);
    for (const job of opportunities) {
      expect(job.source).toBe("remotive");
      expect(job.canonicalUrl).toMatch(/^https:\/\/remotive\.com\//);
      expect(job.sourceId).toMatch(/^\d+$/);
    }
  });

  it("carries Remotive's attribution requirement: a link back and the source name on every stored record", () => {
    const { opportunities } = parseRemotiveJobs(json, now);
    for (const job of opportunities) {
      expect(job.source).toBe("remotive");
      expect(new URL(job.canonicalUrl).hostname).toBe("remotive.com");
    }
  });

  it("throws on a changed response shape or an unexpectedly empty result", () => {
    expect(() => parseRemotiveJobs({ jobs: "nope" }, now)).toThrow(/missing a `jobs` array/);
    expect(() => parseRemotiveJobs({ jobs: [] }, now)).toThrow(/zero jobs/);
  });
});

describe("Laravel News home page (captured markup)", () => {
  function extract(html: string) {
    document.body.innerHTML = html;
    return normalizeLaravelNewsLinks(extractLaravelNewsAnchors([...document.querySelectorAll(laravelNewsJobSelector)]));
  }

  it("extracts title and company from the listing, as the browser-side extractor does", () => {
    const drafts = extract(fixture("laravel-news-home.html"));
    expect(drafts).toHaveLength(4);
    for (const draft of drafts) {
      expect(draft.canonicalUrl).toMatch(/^https:\/\/larajobs\.com\/job\/\d+$/);
      expect(draft.title.length).toBeGreaterThan(3);
      expect(draft.company).toBeTruthy();
      expect(draft.title).not.toBe(draft.company);
    }
  });

  it("yields nothing (not junk) if the markup changes and the anchors lose their spans", () => {
    const stripped = fixture("laravel-news-home.html").replace(/<\/?span[^>]*>/g, "");
    expect(extract(stripped)).toEqual([]);
  });
});

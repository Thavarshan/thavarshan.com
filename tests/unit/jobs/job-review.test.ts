import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/features/jobs/opportunities";
import { makeOpportunity } from "../../helpers/opportunity";
import { filterOpportunities, isStale, parseFilters, safeExternalUrl, sanitizeNote, sortOpportunities, type ReviewMap } from "@/features/jobs/review";

const now = new Date("2026-09-30T00:00:00.000Z");

function job(overrides: Partial<Opportunity> & { id: string }): Opportunity {
  return makeOpportunity({
    title: "Laravel Dev",
    company: "Acme",
    location: "Remote",
    workArrangement: "remote-worldwide",
    seniority: "senior",
    tags: ["laravel"],
    publishedAt: "2026-09-28T00:00:00.000Z",
    firstSeenAt: "2026-09-28T00:00:00.000Z",
    lastSeenAt: "2026-09-29T00:00:00.000Z",
    eligibility: "eligible",
    score: 70,
    confidence: 50,
    ...overrides
  });
}

const params = (query: string) => parseFilters(new URLSearchParams(query));

describe("sortOpportunities", () => {
  it("orders eligible first, then score, then freshness", () => {
    const items = [
      job({ id: "a", eligibility: "unknown", score: 99 }),
      job({ id: "b", eligibility: "eligible", score: 60, publishedAt: "2026-09-20T00:00:00.000Z" }),
      job({ id: "c", eligibility: "eligible", score: 60, publishedAt: "2026-09-29T00:00:00.000Z" }),
      job({ id: "d", eligibility: "eligible", score: 80 }),
      job({ id: "e", eligibility: "ineligible", score: 100 })
    ];
    expect(sortOpportunities(items).map((i) => i.id)).toEqual(["d", "c", "b", "a", "e"]);
  });
});

describe("sort: confidence tie-break", () => {
  it("breaks equal fit scores by confidence, with unscored snapshots last", () => {
    const items = [job({ id: "a", score: 70, confidence: null }), job({ id: "b", score: 70, confidence: 40 }), job({ id: "c", score: 70, confidence: 90 })];
    expect(sortOpportunities(items).map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
});

describe("filterOpportunities", () => {
  const items = [
    job({ id: "a" }),
    job({ id: "b", eligibility: "ineligible" }),
    job({ id: "c", status: "closed" }),
    job({ id: "d", score: 30, tags: ["php", "vue.js"], source: "remotive", sponsorship: "confirmed", salaryMax: 90000 }),
    job({ id: "e", publishedAt: "2026-06-01T00:00:00.000Z", firstSeenAt: "2026-06-01T00:00:00.000Z" })
  ];
  const ids = (query: string, reviews: ReviewMap = {}) => filterOpportunities(items, params(query), reviews, now).map((i) => i.id);

  it("hides ineligible and closed by default", () => {
    expect(ids("")).toEqual(["a", "d", "e"]);
  });

  it("filters by eligibility, closed, score, source, tech, sponsorship, salary and age", () => {
    expect(ids("submitted=1&elig=ineligible")).toEqual(["b"]);
    expect(ids("closed=1")).toContain("c");
    expect(ids("min=50")).toEqual(["a", "e"]);
    expect(ids("src=remotive")).toEqual(["d"]);
    expect(ids("tech=VUE")).toEqual(["d"]);
    expect(ids("spons=confirmed")).toEqual(["d"]);
    expect(ids("sal=listed")).toEqual(["d"]);
    expect(ids("age=30")).toEqual(["a", "d"]);
  });

  it("applies review state: dismissed hidden by default, selectable explicitly", () => {
    const reviews: ReviewMap = { a: { status: "dismissed", note: "", updatedAt: "x" }, d: { status: "shortlisted", note: "", updatedAt: "x" } };
    expect(ids("", reviews)).toEqual(["d", "e"]);
    expect(ids("review=dismissed", reviews)).toEqual(["a"]);
    expect(ids("review=shortlisted", reviews)).toEqual(["d"]);
    expect(ids("review=all", reviews)).toEqual(["a", "d", "e"]);
  });

  it("falls back to safe defaults for malformed parameters", () => {
    const filters = params("min=abc&age=-5&review=<script>&elig=bogus&submitted=1");
    expect(filters.minScore).toBe(0);
    expect(filters.maxAgeDays).toBe(1);
    expect(filters.review).toBe("open");
    expect(filters.eligibility).toEqual([]);
  });
});

describe("helpers", () => {
  it("only allows http(s) external links", () => {
    expect(safeExternalUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });
  it("detects stale snapshots", () => {
    expect(isStale("2026-09-29T12:00:00.000Z", now)).toBe(false);
    expect(isStale("2026-09-20T00:00:00.000Z", now)).toBe(true);
  });
  it("sanitizes and truncates notes", () => {
    expect(sanitizeNote("  hi\u0000there  ")).toBe("hithere");
    expect(sanitizeNote("x".repeat(900))).toHaveLength(500);
    expect(sanitizeNote(42)).toBe("");
  });
});

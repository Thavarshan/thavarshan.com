import { describe, expect, it } from "vitest";
import { mergeOpportunities, type Opportunity, type SourceCollectionOutcome } from "@/lib/job-opportunities";

function makeOpportunity(overrides: Partial<Opportunity> & Pick<Opportunity, "id" | "source" | "canonicalUrl">): Opportunity {
  return {
    sourceUrl: "https://example.com/feed",
    title: "Some Role",
    company: "Some Company",
    location: null,
    workArrangement: "unknown",
    employmentType: null,
    seniority: "unknown",
    salary: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    descriptionText: "",
    tags: [],
    contentFingerprint: overrides.id,
    duplicateOfIds: [],
    publishedAt: null,
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-09-01T00:00:00.000Z",
    status: "active",
    closedAt: null,
    eligibility: "unknown",
    sponsorship: "unknown",
    score: 50,
    reasons: [],
    concerns: [],
    ...overrides
  };
}

describe("mergeOpportunities", () => {
  const now = "2026-09-23T00:00:00.000Z";

  it("preserves firstSeenAt and marks a re-seen item active on upsert", () => {
    const existing = [makeOpportunity({
      id: "a",
      source: "larajobs",
      canonicalUrl: "https://larajobs.com/job/1",
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      status: "new"
    })];
    const results: SourceCollectionOutcome[] = [{
      source: "larajobs",
      opportunities: [makeOpportunity({ id: "a", source: "larajobs", canonicalUrl: "https://larajobs.com/job/1", score: 90 })],
      skipped: 0,
      rejected: 0
    }];

    const { opportunities, stats } = mergeOpportunities(existing, results, now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].firstSeenAt).toBe("2026-01-01T00:00:00.000Z");
    expect(opportunities[0].lastSeenAt).toBe(now);
    expect(opportunities[0].status).toBe("active");
    expect(stats.larajobs.updated).toBe(1);
    expect(stats.larajobs.added).toBe(0);
  });

  it("closes an item that a succeeded source no longer reports, and prunes it after the retention window", () => {
    const existing = [makeOpportunity({ id: "a", source: "larajobs", canonicalUrl: "https://larajobs.com/job/1", status: "active" })];
    const results: SourceCollectionOutcome[] = [{ source: "larajobs", opportunities: [], skipped: 0, rejected: 0 }];

    const firstPass = mergeOpportunities(existing, results, now);
    expect(firstPass.opportunities).toHaveLength(1);
    expect(firstPass.opportunities[0].status).toBe("closed");
    expect(firstPass.opportunities[0].closedAt).toBe(now);
    expect(firstPass.stats.larajobs.closed).toBe(1);

    const muchLater = "2026-11-01T00:00:00.000Z"; // 39 days after `now`
    const secondPass = mergeOpportunities(firstPass.opportunities, results, muchLater);
    expect(secondPass.opportunities).toHaveLength(0);
    expect(secondPass.stats.larajobs.pruned).toBe(1);
  });

  it("leaves a failed source's existing opportunities untouched", () => {
    const existing = [makeOpportunity({
      id: "a",
      source: "remotive",
      canonicalUrl: "https://remotive.com/job/1",
      status: "active",
      lastSeenAt: "2026-01-01T00:00:00.000Z"
    })];
    const results: SourceCollectionOutcome[] = [{ source: "remotive", failed: true, error: "network error" }];

    const { opportunities, stats } = mergeOpportunities(existing, results, now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].status).toBe("active");
    expect(opportunities[0].lastSeenAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stats.remotive).toEqual({ added: 0, updated: 0, unchanged: 0, closed: 0, pruned: 0 });
  });

  it("flags cross-source duplicates by content fingerprint without merging or dropping either record", () => {
    const results: SourceCollectionOutcome[] = [
      {
        source: "larajobs",
        opportunities: [makeOpportunity({ id: "a", source: "larajobs", canonicalUrl: "https://larajobs.com/job/1", contentFingerprint: "shared-fp" })],
        skipped: 0,
        rejected: 0
      },
      {
        source: "remotive",
        opportunities: [makeOpportunity({ id: "b", source: "remotive", canonicalUrl: "https://remotive.com/job/1", contentFingerprint: "shared-fp" })],
        skipped: 0,
        rejected: 0
      }
    ];

    const { opportunities } = mergeOpportunities([], results, now);
    const a = opportunities.find((item) => item.id === "a")!;
    const b = opportunities.find((item) => item.id === "b")!;
    expect(a.duplicateOfIds).toEqual(["b"]);
    expect(b.duplicateOfIds).toEqual(["a"]);
  });

  it("never flags two same-source items as duplicates of each other", () => {
    const results: SourceCollectionOutcome[] = [{
      source: "larajobs",
      opportunities: [
        makeOpportunity({ id: "a", source: "larajobs", canonicalUrl: "https://larajobs.com/job/1", contentFingerprint: "shared-fp" }),
        makeOpportunity({ id: "b", source: "larajobs", canonicalUrl: "https://larajobs.com/job/2", contentFingerprint: "shared-fp" })
      ],
      skipped: 0,
      rejected: 0
    }];

    const { opportunities } = mergeOpportunities([], results, now);
    expect(opportunities.every((item) => item.duplicateOfIds.length === 0)).toBe(true);
  });
});

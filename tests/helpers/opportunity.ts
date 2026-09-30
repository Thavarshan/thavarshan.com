import { opportunitySchema, type Opportunity } from "@/features/jobs/opportunities";

/**
 * Builds a valid Opportunity by parsing through the real schema, so additive fields pick up their
 * defaults and fixtures never need editing when an optional field is added.
 */
export function makeOpportunity(overrides: Partial<Opportunity> & { id: string }): Opportunity {
  return opportunitySchema.parse({
    source: "larajobs",
    sourceUrl: "https://example.com/feed",
    canonicalUrl: `https://example.com/${overrides.id}`,
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
  });
}

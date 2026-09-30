// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COLLECTOR_VERSION,
  EMPTY_SOURCE_GRACE_HOURS,
  computeDescriptionHash,
  deriveSourceId,
  mergeOpportunities,
  opportunitySnapshotSchema
} from "@/lib/job-opportunities";
import { loadSnapshot } from "@/lib/job-snapshot";
import { buildOpportunity, sanitizeApplicationUrl } from "@/scripts/jobs/opportunity-builder";
import { makeOpportunity } from "../helpers/opportunity";

const now = "2026-09-30T00:00:00.000Z";
const base = { title: "Senior Laravel Developer", url: "https://larajobs.com/job/3931?utm=x", sourceUrl: "https://larajobs.com/feed", source: "larajobs" as const };

describe("buildOpportunity populates the extended contract", () => {
  it("derives period, geography, relocation, source id and description hash from real fields", () => {
    const job = buildOpportunity({
      ...base,
      company: "Acme",
      location: "Remote / Germany",
      salary: "€70,000 - €90,000 per year",
      description: "Overlap with CET hours. We offer a relocation package. Candidates must be based in Germany.",
      applicationUrl: "https://boards.greenhouse.io/acme/jobs/1#apply"
    }, now);
    expect(job).toMatchObject({
      salaryPeriod: "year",
      salaryCurrency: "EUR",
      countries: ["DE"],
      timezones: ["CET"],
      relocation: "offered",
      sourceId: "3931",
      applicationUrl: "https://boards.greenhouse.io/acme/jobs/1"
    });
    expect(job.descriptionHash).toBe(computeDescriptionHash(job.descriptionText));
  });

  it("uses explicit empties/unknowns when the posting says nothing", () => {
    const job = buildOpportunity({ ...base, description: "We build software." }, now);
    expect(job).toMatchObject({ salaryPeriod: null, countries: [], regions: [], timezones: [], relocation: "unknown", applicationUrl: null });
  });
});

describe("description hash", () => {
  it("is stable across whitespace/case and changes with content", () => {
    expect(computeDescriptionHash("Hello   World\n")).toBe(computeDescriptionHash("hello world"));
    expect(computeDescriptionHash("hello world")).not.toBe(computeDescriptionHash("hello there"));
  });

  it("drives the merge 'updated' count when only the description changes", () => {
    const previous = makeOpportunity({ id: "a", canonicalUrl: "https://larajobs.com/job/1", descriptionText: "old text", descriptionHash: computeDescriptionHash("old text") });
    const changed = makeOpportunity({ id: "a", canonicalUrl: "https://larajobs.com/job/1", descriptionText: "new text", descriptionHash: computeDescriptionHash("new text") });
    const { stats } = mergeOpportunities([previous], [{ source: "larajobs", opportunities: [changed], skipped: 0, rejected: 0 }], now);
    expect(stats.larajobs.updated).toBe(1);
    const same = mergeOpportunities([previous], [{ source: "larajobs", opportunities: [{ ...previous }], skipped: 0, rejected: 0 }], now);
    expect(same.stats.larajobs.unchanged).toBe(1);
  });
});

describe("deriveSourceId", () => {
  it("extracts each source's own identifier", () => {
    expect(deriveSourceId("larajobs", "https://larajobs.com/job/3931")).toBe("3931");
    expect(deriveSourceId("laravel-news", "https://larajobs.com/job/3925")).toBe("3925");
    expect(deriveSourceId("weworkremotely", "https://weworkremotely.com/remote-jobs/acculynx-senior-software-engineer")).toBe("acculynx-senior-software-engineer");
    expect(deriveSourceId("remotive", "https://remotive.com/remote-jobs/software-dev/laravel-dev-2091144")).toBe("2091144");
    expect(deriveSourceId("larajobs", "https://larajobs.com/")).toBeNull();
    expect(deriveSourceId("larajobs", "not a url")).toBeNull();
  });
});

describe("sanitizeApplicationUrl", () => {
  it("keeps only usable http(s) employer URLs, dropping board hosts, auth walls and fragments", () => {
    expect(sanitizeApplicationUrl("https://careers.acme.com/jobs/1#top")).toBe("https://careers.acme.com/jobs/1");
    expect(sanitizeApplicationUrl("https://larajobs.com/job/1")).toBeNull();
    expect(sanitizeApplicationUrl("https://www.weworkremotely.com/x")).toBeNull();
    expect(sanitizeApplicationUrl("https://accounts.google.com/signin")).toBeNull();
    expect(sanitizeApplicationUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeApplicationUrl("not a url")).toBeNull();
    expect(sanitizeApplicationUrl(null)).toBeNull();
  });
});

describe("per-source empty-result guard", () => {
  const seen = (id: string, hoursAgo: number, source: "remotive" | "larajobs" = "remotive") =>
    makeOpportunity({ id, source, canonicalUrl: `https://example.com/${id}`, lastSeenAt: new Date(new Date(now).getTime() - hoursAgo * 3_600_000).toISOString() });
  const empty = (source: "remotive" | "larajobs" = "remotive") => [{ source, opportunities: [], skipped: 0, rejected: 0 }];

  it("holds recently-seen listings open when a source that had many suddenly returns nothing", () => {
    const existing = [seen("a", 20), seen("b", 20), seen("c", 20), seen("d", 20)];
    const { opportunities, stats } = mergeOpportunities(existing, empty(), now);
    expect(opportunities.every((item) => item.status === "active")).toBe(true);
    expect(stats.remotive).toMatchObject({ held: 4, closed: 0 });
  });

  it("closes them once the grace window has lapsed, so a genuinely empty source still clears", () => {
    const stale = EMPTY_SOURCE_GRACE_HOURS + 24;
    const existing = [seen("a", stale), seen("b", stale), seen("c", stale), seen("d", 20)];
    const { opportunities, stats } = mergeOpportunities(existing, empty(), now);
    expect(stats.remotive).toMatchObject({ held: 1, closed: 3 });
    expect(opportunities.filter((item) => item.status === "closed").map((item) => item.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("does not hold when the source had only a few listings (a normal small source emptying)", () => {
    const { stats } = mergeOpportunities([seen("a", 20), seen("b", 20)], empty(), now);
    expect(stats.remotive).toMatchObject({ held: 0, closed: 2 });
  });

  it("does not apply when the source returned anything, and never touches other sources", () => {
    const existing = [seen("a", 20), seen("b", 20), seen("c", 20), seen("x", 20, "larajobs")];
    const survivor = seen("a", 0);
    const { stats, opportunities } = mergeOpportunities(existing, [{ source: "remotive", opportunities: [survivor], skipped: 0, rejected: 0 }], now);
    expect(stats.remotive).toMatchObject({ held: 0, closed: 2 });
    expect(opportunities.find((item) => item.id === "x")?.status).toBe("active");
  });
});

describe("backward compatibility (additive, no schemaVersion bump)", () => {
  it("loads the committed snapshot and an older one without the new fields, filling defaults", async () => {
    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(new URL("../../data/jobs.generated.json", import.meta.url), "utf8"));
    const legacy = structuredClone(raw);
    delete legacy.collectorVersion;
    for (const source of legacy.sources) delete source.held;
    for (const item of legacy.opportunities) {
      for (const key of ["salaryPeriod", "sourceId", "descriptionHash", "applicationUrl", "countries", "regions", "timezones", "relocation"]) delete item[key];
    }
    const { snapshot, migratedFrom } = loadSnapshot(legacy);
    expect(migratedFrom).toBeNull();
    expect(snapshot.collectorVersion).toBeNull();
    expect(snapshot.sources[0].held).toBe(0);
    expect(snapshot.opportunities[0]).toMatchObject({ salaryPeriod: null, sourceId: null, descriptionHash: null, applicationUrl: null, countries: [], regions: [], timezones: [], relocation: "unknown" });
  });

  it("records the collector version on new snapshots", () => {
    expect(COLLECTOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const parsed = opportunitySnapshotSchema.parse({
      schemaVersion: 2, generatedAt: now, collectorVersion: COLLECTOR_VERSION,
      candidate: { location: "Sri Lanka", preferredStack: [], experienceYears: 11, workModes: ["remote"] }, sources: [], opportunities: []
    });
    expect(parsed.collectorVersion).toBe(COLLECTOR_VERSION);
  });
});

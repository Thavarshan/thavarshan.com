import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import positioning from "../../../marketing/search-positioning.json";
import { positioningSchema } from "../../../automation/marketing/positioning/model";
import { buildContentReview, collectContentReview, publicSourceDigests, stableEvidence } from "../../../automation/marketing/content-review";

const map = positioningSchema.parse(positioning);
const digest = "a".repeat(64);
const digests = Object.fromEntries(map.pages.map((page) => [page.path, digest]));
const state = () => ({
  schemaVersion: 1,
  capturedAt: "2026-10-11",
  pages: map.pages.map((page) => ({ path: page.path, sourceDigest: digest, reviewedAt: null as string | null }))
});
const now = new Date("2026-10-11T12:00:00Z");

describe("editorial review signals", () => {
  it("uses the Sri Lanka calendar day for owner review dates across UTC midnight", () => {
    const input = state();
    input.pages[0].reviewedAt = "2026-10-12";
    const report = buildContentReview(map, input, digests, new Date("2026-10-11T19:00:00Z"), { "/": "2026-10-12" });
    expect(report.pages[0]).toMatchObject({ ageDays: 0, sourceAgeDays: 0, unreviewed: false, overdue: false });
  });
  it("starts unreviewed and never turns a snapshot into human approval", () => {
    const input = state();
    expect(buildContentReview(map, input, digests, now).pages.every((page) => page.unreviewed && page.reviewedAt === null)).toBe(true);
    expect(input.pages.every((page) => page.reviewedAt === null)).toBe(true);
  });
  it("flags review deadlines and changed evidence independently", () => {
    const input = state();
    input.pages[0].reviewedAt = "2026-07-13";
    let report = buildContentReview(map, input, digests, now);
    expect(report.pages[0]).toMatchObject({ ageDays: 90, overdue: true, sourceChanged: false });
    input.pages[0].reviewedAt = "2026-07-14";
    report = buildContentReview(map, input, { ...digests, "/": "b".repeat(64) }, now);
    expect(report.pages[0]).toMatchObject({ ageDays: 89, overdue: false, sourceChanged: true });
    report = buildContentReview(map, input, digests, now, { "/": "2026-07-13" });
    expect(report.pages[0]).toMatchObject({ ageDays: 89, sourceAgeDays: 90, sourceDate: "2026-07-13" });
    expect(() => buildContentReview(map, input, digests, now, { "/": "2026-10-12" })).toThrow(/Future/);
  });
  it("refuses future, duplicate and unrelated review records", () => {
    const future = state();
    future.pages[0].reviewedAt = "2026-10-12";
    expect(() => buildContentReview(map, future, digests, now)).toThrow(/record/);
    const duplicate = state();
    duplicate.pages.push(duplicate.pages[0]);
    expect(() => buildContentReview(map, duplicate, digests, now)).toThrow(/baseline/);
    const unrelated = state();
    unrelated.pages[0].path = "/private";
    expect(() => buildContentReview(map, unrelated, digests, now)).toThrow(/record/);
  });
  it("ignores snapshot churn while retaining authored evidence and project isolation", () => {
    const snapshot = JSON.parse(readFileSync("data/github.generated.json", "utf8"));
    const original = JSON.stringify(snapshot);
    snapshot.syncedAt = "2027-01-01T00:00:00Z";
    snapshot.projects[0].stars += 100;
    snapshot.projects[0].updatedAt = "2027-01-01T00:00:00Z";
    expect(stableEvidence("data/github.generated.json", original, "/projects/fetch-php")).toBe(
      stableEvidence("data/github.generated.json", JSON.stringify(snapshot), "/projects/fetch-php")
    );
    snapshot.projects[0].description += " changed";
    expect(stableEvidence("data/github.generated.json", original, "/projects/fetch-php")).not.toBe(
      stableEvidence("data/github.generated.json", JSON.stringify(snapshot), "/projects/fetch-php")
    );
    expect(stableEvidence("data/github.generated.json", original, "/projects/matrix")).toBe(
      stableEvidence("data/github.generated.json", JSON.stringify(snapshot), "/projects/matrix")
    );
  });
  it("reads only public evidence and emits no source text or private fields", async () => {
    expect(Object.keys(await publicSourceDigests())).toHaveLength(map.pages.length);
    const report = await collectContentReview();
    expect(report.pages.map((page) => page.path)).toEqual(map.pages.map((page) => page.path));
    expect(JSON.stringify(report)).not.toMatch(/query|recommendation|client_email|sourceDigest|readmeExcerpt/);
    const traversal = structuredClone(map);
    traversal.pages[0].evidence = ["src/../.search-feedback/report.json"];
    await expect(publicSourceDigests(traversal)).rejects.toThrow(/evidence/);
  });
});

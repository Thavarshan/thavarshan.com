// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeContentFingerprint, computeDescriptionHash, opportunityId, type Opportunity } from "@/features/jobs/opportunities";

/**
 * Job ids, content fingerprints and description hashes are stored in the committed snapshot and used to
 * dedupe and detect change. The hashing implementation must therefore reproduce them EXACTLY; if this
 * fails, every job would look new on the next collection.
 */
const snapshot = JSON.parse(readFileSync("data/jobs.generated.json", "utf8")) as { opportunities: Opportunity[] };

describe("stored job hashes are reproduced exactly", () => {
  it("has real records to check", () => {
    expect(snapshot.opportunities.length).toBeGreaterThan(10);
  });

  it("opportunity id == hash of the canonical URL, for every stored record", () => {
    const mismatched = snapshot.opportunities.filter((item) => opportunityId(item.canonicalUrl) !== item.id).map((item) => item.canonicalUrl);
    expect(mismatched).toEqual([]);
  });

  it("content fingerprint == hash of company + title, for every stored record", () => {
    const mismatched = snapshot.opportunities.filter((item) => item.contentFingerprint && computeContentFingerprint(item.company, item.title) !== item.contentFingerprint).map((item) => item.title);
    expect(mismatched).toEqual([]);
  });

  it("description hash == hash of the stored description, wherever one is recorded", () => {
    const withHash = snapshot.opportunities.filter((item) => item.descriptionHash);
    expect(withHash.length).toBeGreaterThan(5);
    const mismatched = withHash.filter((item) => computeDescriptionHash(item.descriptionText) !== item.descriptionHash).map((item) => item.title);
    expect(mismatched).toEqual([]);
  });
});

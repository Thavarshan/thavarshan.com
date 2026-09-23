import { describe, expect, it } from "vitest";
import { scanForUnlistedTerms } from "@/lib/hallucination-check";

const allowlist = ["Jerome Thayananthajothy", "Sino Lanka Group", "Senior Software Engineer", "Acme Remote", "Laravel Developer"];

describe("scanForUnlistedTerms", () => {
  it("does not flag terms that appear in the allowlist", () => {
    const text = "I'm excited to apply to Acme Remote for the Laravel Developer role, building on my time at Sino Lanka Group.";
    expect(scanForUnlistedTerms(text, allowlist)).toEqual([]);
  });

  it("flags a multi-word proper noun that is not in the allowlist", () => {
    const text = "During my three years at Global Tech Solutions Inc, I led the platform team.";
    expect(scanForUnlistedTerms(text, allowlist)).toContain("Global Tech Solutions Inc");
  });

  it("ignores common cover-letter boilerplate phrases", () => {
    const text = "Dear Hiring Team, thank you for your consideration. Best Regards, Jerome Thayananthajothy";
    expect(scanForUnlistedTerms(text, allowlist)).toEqual([]);
  });

  it("does not flag single capitalized words at sentence starts", () => {
    const text = "Building scalable systems has been my focus. Every project taught me something new.";
    expect(scanForUnlistedTerms(text, allowlist)).toEqual([]);
  });

  it("does not flag a real allowlisted entity when a capitalized filler word is glued onto the front", () => {
    const text = "At Sino Lanka Group, I led the platform modernization effort.";
    expect(scanForUnlistedTerms(text, allowlist)).toEqual([]);
  });

  it("still flags an unlisted entity even when it follows a capitalized filler word", () => {
    const text = "At Nimbus Robotics, I led the platform modernization effort.";
    expect(scanForUnlistedTerms(text, allowlist)).toContain("At Nimbus Robotics");
  });
});

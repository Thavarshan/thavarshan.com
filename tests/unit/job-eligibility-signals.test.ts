import { describe, expect, it } from "vitest";
import { deriveSeniority, exclusionSignals } from "@/lib/job-eligibility-signals";

function matchingConcerns(text: string) {
  return exclusionSignals.filter(([pattern]) => pattern.test(text)).map(([, concern]) => concern);
}

describe("exclusionSignals (restricted region detection)", () => {
  it("matches new regions via the '-only' and 'must be located in' templates", () => {
    expect(matchingConcerns("This role is Australia-only.")).toContain("Restricted to Australia");
    expect(matchingConcerns("Applicants must be located in Germany.")).toContain("Restricted to Germany");
    expect(matchingConcerns("You must have the right to work in India.")).toContain("Restricted to India");
    expect(matchingConcerns("Open to candidates in the UAE or Dubai.")).toEqual([]);
    expect(matchingConcerns("This role is UAE-only.")).toContain("Restricted to the UAE");
  });

  it("never false-triggers India's restriction on the common word 'in'", () => {
    expect(matchingConcerns("Please let us know if you have any questions.")).toEqual([]);
    expect(matchingConcerns("We are interested in candidates with Laravel experience.")).toEqual([]);
    expect(matchingConcerns("Fully remote, work from anywhere in the world.")).toEqual([]);
  });

  it("still matches the original four regions unchanged", () => {
    expect(matchingConcerns("US-only role.")).toContain("Restricted to the United States");
    expect(matchingConcerns("Right to work in the UK required.")).toContain("Restricted to candidates with UK work authorization");
    expect(matchingConcerns("EU-only, sorry.")).toContain("Restricted to Europe");
    expect(matchingConcerns("Canada-only for now.")).toContain("Restricted to Canada");
  });
});

describe("deriveSeniority", () => {
  it("prioritizes lead-tier keywords over a plain 'senior' mention", () => {
    expect(deriveSeniority("Senior Staff Engineer")).toBe("lead");
    expect(deriveSeniority("Principal Laravel Engineer")).toBe("lead");
  });

  it("detects senior, junior, and mid levels", () => {
    expect(deriveSeniority("Senior Laravel Developer")).toBe("senior");
    expect(deriveSeniority("Junior PHP Developer")).toBe("junior");
    expect(deriveSeniority("Entry-level Backend Developer")).toBe("junior");
    expect(deriveSeniority("Mid-level Full-Stack Developer")).toBe("mid");
  });

  it("returns unknown when no seniority keyword is present", () => {
    expect(deriveSeniority("Full-Stack Developer")).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import { validateCvTailoringPlan } from "@/lib/application-tailoring";
import type { ExperienceRecord } from "@/lib/profile-schema";

function role(overrides: Partial<ExperienceRecord> & Pick<ExperienceRecord, "id">): ExperienceRecord {
  return {
    role: "Software Engineer",
    company: "Acme",
    startDate: "2020-01",
    endDate: null,
    summary: "",
    highlights: ["Shipped feature A", "Led project B", "Mentored two engineers"],
    ...overrides
  };
}

const profile = {
  experience: [
    role({ id: "role-1", company: "Acme", highlights: ["Shipped feature A", "Led project B"] }),
    role({ id: "role-2", company: "Beta Corp", highlights: ["Reduced latency by 40%", "Owned the API layer"] })
  ]
};

describe("validateCvTailoringPlan", () => {
  it("keeps a valid plan as-is", () => {
    const result = validateCvTailoringPlan(
      {
        emphasizedSkillCategories: ["full-stack", "cloud-delivery", "ai-architecture", "leadership"],
        experienceOrder: ["role-2", "role-1"],
        highlightSelections: { "role-1": ["Led project B"], "role-2": ["Owned the API layer", "Reduced latency by 40%"] },
        reviewFlags: ["Job posting did not mention seniority explicitly"]
      },
      profile
    );

    expect(result.experienceOrder).toEqual(["role-2", "role-1"]);
    expect(result.highlightSelections["role-1"]).toEqual(["Led project B"]);
    expect(result.highlightSelections["role-2"]).toEqual(["Owned the API layer", "Reduced latency by 40%"]);
    expect(result.emphasizedSkillCategories).toEqual(["full-stack", "cloud-delivery", "ai-architecture", "leadership"]);
    expect(result.warnings).toEqual([]);
    expect(result.reviewFlags).toEqual(["Job posting did not mention seniority explicitly"]);
  });

  it("drops an invented highlight instead of trusting it", () => {
    const result = validateCvTailoringPlan(
      { experienceOrder: [], highlightSelections: { "role-1": ["Shipped feature A", "Invented a highlight that was never in the profile"] } },
      profile
    );

    expect(result.highlightSelections["role-1"]).toEqual(["Shipped feature A"]);
    expect(result.warnings.some((warning) => warning.includes("role-1") || warning.includes("Software Engineer"))).toBe(true);
  });

  it("falls back to default highlights when every suggested one is unrecognized", () => {
    const result = validateCvTailoringPlan(
      { highlightSelections: { "role-1": ["This bullet does not exist in the profile at all"] } },
      profile
    );

    expect(result.highlightSelections["role-1"]).toBeUndefined();
    expect(result.warnings.some((warning) => warning.includes("unrecognized"))).toBe(true);
  });

  it("never drops an experience entry the model omits from experienceOrder", () => {
    const result = validateCvTailoringPlan({ experienceOrder: ["role-2"] }, profile);
    expect(result.experienceOrder).toEqual(["role-2", "role-1"]);
    expect(result.warnings.some((warning) => warning.includes("experienceOrder"))).toBe(true);
  });

  it("ignores an unknown experience id rather than injecting it", () => {
    const result = validateCvTailoringPlan({ experienceOrder: ["role-2", "role-1", "role-does-not-exist"] }, profile);
    expect(result.experienceOrder).toEqual(["role-2", "role-1"]);
  });

  it("falls back to the default category order when the model returns an invalid permutation", () => {
    const result = validateCvTailoringPlan({ emphasizedSkillCategories: ["full-stack", "full-stack"] }, profile);
    expect(result.emphasizedSkillCategories).toEqual(["leadership", "ai-architecture", "full-stack", "cloud-delivery"]);
  });

  it("handles a completely empty or malformed raw plan gracefully", () => {
    const result = validateCvTailoringPlan(null, profile);
    expect(result.experienceOrder).toEqual(["role-1", "role-2"]);
    expect(result.highlightSelections).toEqual({});
    expect(result.emphasizedSkillCategories).toHaveLength(4);
  });
});

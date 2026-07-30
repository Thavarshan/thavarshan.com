import { describe, expect, it } from "vitest";
import githubData from "@/data/github.generated.json";
import profileData from "@/data/profile.generated.json";
import { githubSnapshotSchema } from "@/lib/github-model";
import { findProfileConflicts } from "@/lib/profile-conflicts";
import { parseProfessionalProfile } from "@/lib/profile-schema";

describe("profile source precedence", () => {
  it("reports outdated GitHub employer data without changing LinkedIn career data", () => {
    const profile = parseProfessionalProfile(profileData);
    const warnings = findProfileConflicts(profile, githubSnapshotSchema.parse(githubData));

    expect(profile.experience[0].company).toBe("Sino Lanka Group");
    expect(warnings.join(" ")).toContain("current LinkedIn employer");
  });
});

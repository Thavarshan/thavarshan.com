import { describe, expect, it } from "vitest";
import { renderResumeLatex } from "@/lib/latex";
import type { GitHubSnapshot } from "@/lib/github-model";
import type { ProfessionalProfile } from "@/lib/profile-schema";

const github: GitHubSnapshot = {
  username: "Thavarshan",
  name: "Jerome",
  company: null,
  location: null,
  bio: null,
  profileUrl: "https://github.com/Thavarshan",
  followers: 0,
  publicRepositories: 0,
  syncedAt: "2026-09-23T00:00:00.000Z",
  projects: []
};

const profile: ProfessionalProfile = {
  schemaVersion: 1,
  identity: {
    name: "Jerome Thayananthajothy",
    givenName: "Jerome",
    familyName: "Thayananthajothy",
    headline: "Software Engineer",
    location: "Colombo, Sri Lanka",
    email: "jerome@example.com",
    website: "https://thavarshan.com",
    linkedin: "https://linkedin.com/in/thavarshan",
    github: "https://github.com/Thavarshan",
    avatar: "avatar.jpg"
  },
  summary: "Experienced software engineer.",
  experience: [
    { id: "role-1", role: "Engineer", company: "Acme", startDate: "2018-01", endDate: "2020-01", summary: "", highlights: ["Acme highlight one", "Acme highlight two"] },
    { id: "role-2", role: "Senior Engineer", company: "Beta", startDate: "2020-01", endDate: null, summary: "", highlights: ["Beta highlight one", "Beta highlight two"] }
  ],
  education: [],
  certifications: [],
  skills: [
    { name: "Leadership skill", category: "leadership" },
    { name: "Laravel", category: "full-stack" }
  ],
  languages: [],
  professionalProjects: [],
  sources: {
    linkedin: { kind: "linkedin-archive", importedAt: "2026-01-01T00:00:00.000Z", fingerprint: "abc" },
    github: { kind: "github-api", username: "Thavarshan", syncedAt: "2026-01-01T00:00:00.000Z" }
  },
  modifiedAt: "2026-01-01T00:00:00.000Z"
};

describe("renderResumeLatex with a tailoring plan", () => {
  it("keeps default (profile) order when no tailoring plan is given", () => {
    const tex = renderResumeLatex(profile, github);
    expect(tex.indexOf("Acme")).toBeLessThan(tex.indexOf("Beta"));
    expect(tex).toContain("Acme highlight one");
  });

  it("reorders experience and selects highlights per the tailoring plan", () => {
    const tex = renderResumeLatex(profile, github, {
      emphasizedSkillCategories: ["full-stack", "cloud-delivery", "ai-architecture", "leadership"],
      experienceOrder: ["role-2", "role-1"],
      highlightSelections: { "role-1": ["Acme highlight two"] },
      reviewFlags: [],
      warnings: []
    });

    expect(tex.indexOf("Beta")).toBeLessThan(tex.indexOf("Acme"));
    expect(tex).toContain("Acme highlight two");
    expect(tex).not.toContain("Acme highlight one");
    expect(tex).toContain("Beta highlight one");
    expect(tex).toContain("Beta highlight two");
  });

  it("never drops a skill category even if it has no matching skills in the profile", () => {
    const tex = renderResumeLatex(profile, github, {
      emphasizedSkillCategories: ["cloud-delivery", "leadership", "full-stack", "ai-architecture"],
      experienceOrder: [],
      highlightSelections: {},
      reviewFlags: [],
      warnings: []
    });

    expect(tex).toContain("Leadership");
    expect(tex).toContain("Full Stack");
  });
});

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
  it("orders experience most-recent-first when no tailoring plan is given, regardless of input array order", () => {
    const tex = renderResumeLatex(profile, github);
    expect(tex.indexOf("Beta")).toBeLessThan(tex.indexOf("Acme"));
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

describe("renderResumeLatex early-career condensing", () => {
  const longProfile: ProfessionalProfile = {
    ...profile,
    experience: [
      { id: "r0", role: "Role 0", company: "Company 0", startDate: "2024-01", endDate: null, summary: "", highlights: [] },
      { id: "r1", role: "Role 1", company: "Company 1", startDate: "2023-01", endDate: "2024-01", summary: "", highlights: [] },
      { id: "r2", role: "Role 2", company: "Company 2", startDate: "2022-01", endDate: "2023-01", summary: "", highlights: [] },
      { id: "r3", role: "Role 3", company: "Company 3", startDate: "2021-01", endDate: "2022-01", summary: "", highlights: [] },
      { id: "r4", role: "Role 4", company: "Company 4", startDate: "2020-01", endDate: "2021-01", summary: "", highlights: [] },
      { id: "r5", role: "Role 5", company: "Company 5", startDate: "2019-01", endDate: "2020-01", summary: "", highlights: [] },
      { id: "r6", role: "Role 6", company: "Company 6", startDate: "2018-01", endDate: "2019-01", summary: "", highlights: [] },
      { id: "r7", role: "Role 7", company: "Company 7", startDate: "2017-01", endDate: "2018-01", summary: "", highlights: [] },
      { id: "r8", role: "Role 8", company: "Company 8", startDate: "2016-01", endDate: "2017-01", summary: "", highlights: [] },
      { id: "intern1", role: "Intern", company: "Old Co", startDate: "2015-06", endDate: "2015-09", summary: "", highlights: [] },
      { id: "intern2", role: "Intern", company: "Older Co", startDate: "2014-06", endDate: "2014-09", summary: "", highlights: [] }
    ]
  };

  it("condenses chronologically old entries beyond the featured limit into one Early Career line", () => {
    const tex = renderResumeLatex(longProfile, github);
    expect(tex).toContain("Role 0");
    expect(tex).toContain("Role 8");
    expect(tex).not.toContain("\\resumeHeading{Intern}");
    expect(tex).toContain("Early Career");
    expect(tex).toContain("Intern, Old Co (2015)");
    expect(tex).toContain("Intern, Older Co (2014)");
  });

  it("never pulls a chronologically-condensed entry back into the featured section via tailoring", () => {
    const tex = renderResumeLatex(longProfile, github, {
      emphasizedSkillCategories: ["full-stack", "cloud-delivery", "ai-architecture", "leadership"],
      experienceOrder: ["intern1", "r0"],
      highlightSelections: {},
      reviewFlags: [],
      warnings: []
    });

    expect(tex).not.toContain("\\resumeHeading{Intern}");
    expect(tex).toContain("Early Career");
  });
});

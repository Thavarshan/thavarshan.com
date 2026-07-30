import { describe, expect, it } from "vitest";
import githubData from "@/data/github.generated.json";
import profileData from "@/data/profile.generated.json";
import { githubSnapshotSchema } from "@/lib/github-model";
import { escapeLatex, renderResumeLatex } from "@/lib/latex";
import { parseProfessionalProfile } from "@/lib/profile-schema";

describe("LaTeX CV generation", () => {
  it("escapes untrusted profile text", () => {
    expect(escapeLatex("R&D_100% #1")).toBe("R\\&D\\_100\\% \\#1");
  });

  it("renders a phone-free, ATS-oriented document from source data", () => {
    const output = renderResumeLatex(
      parseProfessionalProfile(profileData),
      githubSnapshotSchema.parse(githubData)
    );

    expect(output).toContain("\\documentclass");
    expect(output).toContain("Jerome Thayananthajothy");
    expect(output).toContain("Selected Open-Source Work");
    expect(output).not.toContain("+94 742729879");
    expect(output).not.toContain("\\includegraphics");
  });
});

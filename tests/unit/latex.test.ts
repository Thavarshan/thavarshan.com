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

  it("inserts \\texttrademark{}/\\textregistered{} as real commands, not escaped literal text", () => {
    // Regression: inserting these before the special-character escaping pass caused their own
    // backslash/braces to be re-escaped into literal "\texttrademark{}" text in the rendered PDF.
    expect(escapeLatex("MacroActive™")).toBe("MacroActive\\texttrademark{}");
    expect(escapeLatex("NetWatch Global®")).toBe("NetWatch Global\\textregistered{}");
  });

  it("normalizes curly quotes/apostrophes and arrows the Latin Modern font can't render", () => {
    expect(escapeLatex("It’s a “test” → done")).toBe("It's a \"test\" -> done");
  });

  it("strips emoji the CV font has no glyph for", () => {
    expect(escapeLatex("\u{1F50D} Enhance Laravel queries")).toBe(" Enhance Laravel queries");
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

import { describe, expect, it } from "vitest";
import { renderCoverLetterLatex } from "@/lib/cover-letter-latex";
import type { ProfessionalProfile } from "@/lib/profile-schema";

const profile = {
  identity: {
    name: "Jerome Thayananthajothy",
    location: "Colombo, Sri Lanka",
    email: "jerome@example.com",
    website: "https://thavarshan.com"
  }
} as ProfessionalProfile;

describe("renderCoverLetterLatex", () => {
  it("renders a valid LaTeX document addressed to the target company", () => {
    const tex = renderCoverLetterLatex(
      profile,
      { title: "Senior Laravel Developer", company: "Acme & Co" },
      "First paragraph.\n\nSecond paragraph with a $ sign and an & symbol.",
      new Date("2026-09-23T00:00:00.000Z")
    );

    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
    expect(tex).toContain("Acme \\& Co Hiring Team");
    expect(tex).toContain("Re: Senior Laravel Developer");
    expect(tex).toContain("First paragraph.");
    expect(tex).toContain("Second paragraph with a \\$ sign and an \\& symbol.");
  });

  it("falls back to a generic salutation when the company is unknown", () => {
    const tex = renderCoverLetterLatex(profile, { title: "Backend Engineer", company: null }, "Body text.", new Date("2026-09-23T00:00:00.000Z"));
    expect(tex).toContain("Dear Hiring Team,");
  });
});

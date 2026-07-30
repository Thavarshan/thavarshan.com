import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import profileData from "@/data/profile.generated.json";
import { importLinkedInArchive, normalizeLinkedInDate, splitLinkedInDescription } from "@/lib/linkedin-archive";
import { parseProfessionalProfile } from "@/lib/profile-schema";

const previous = parseProfessionalProfile(profileData);

function archive(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])));
}

describe("LinkedIn archive import", () => {
  it("imports professional sections and preserves public contact policy", () => {
    const result = importLinkedInArchive(
      archive({
        "Profile.csv": [
          "First Name,Last Name,Headline,Summary,Geo Location",
          'Jerome,Thayananthajothy,"Technical Lead and AI Architect","Builds reliable systems.","Colombo, Sri Lanka"'
        ].join("\n"),
        "Positions.csv": [
          "Company Name,Title,Description,Started On,Finished On,Location",
          'Example Group,Technical Lead,"Led platform architecture.\nImproved delivery reliability.",May 2026,,"Colombo, Sri Lanka"'
        ].join("\n"),
        "Education.csv": [
          "School Name,Degree Name,Field Of Study,Start Date,End Date",
          "Example University,BSc,Computer Science,Sep 2020,Jun 2023"
        ].join("\n"),
        "Skills.csv": "Name\nAWS\nTechnical Leadership\nReact",
        "Certifications.csv": "Name,Authority\nAWS Certified Example,Amazon Web Services",
        "Projects.csv": "Title,Description,Url\nExample Product,Commercial product delivery.,https://example.com",
        "Languages.csv": "Name,Proficiency\nEnglish,Native or bilingual proficiency"
      }),
      previous,
      { now: new Date("2026-08-01T00:00:00.000Z") }
    );

    expect(result.profile.experience[0]).toMatchObject({
      company: "Example Group",
      role: "Technical Lead",
      startDate: "2026-05",
      endDate: null
    });
    expect(result.profile.experience[0].highlights).toContain("Improved delivery reliability.");
    expect(result.profile.education[0].institution).toBe("Example University");
    expect(result.profile.identity.email).toBe("tjthavarshan@gmail.com");
    expect(JSON.stringify(result.profile)).not.toContain("+94 742729879");
    expect(result.warnings).toHaveLength(0);
  });

  it("preserves sections omitted from a partial archive", () => {
    const result = importLinkedInArchive(
      archive({
        "Profile.csv": "First Name,Last Name,Headline\nJerome,Thayananthajothy,Updated headline"
      }),
      previous
    );

    expect(result.profile.identity.headline).toBe("Updated headline");
    expect(result.profile.experience).toEqual(previous.experience);
    expect(result.warnings).toContain("experience was not present and has been preserved from the previous profile");
  });

  it("rejects malformed supplied dates without replacing data", () => {
    expect(() =>
      importLinkedInArchive(
        archive({
          "Positions.csv": "Company Name,Title,Started On\nExample,Lead,not-a-date"
        }),
        previous
      )
    ).toThrow(/Unsupported LinkedIn date/);
  });

  it("normalizes common dates and deterministic bullets", () => {
    expect(normalizeLinkedInDate("May 2026")).toBe("2026-05");
    expect(normalizeLinkedInDate("05/2026")).toBe("2026-05");
    expect(splitLinkedInDescription("Led architecture.\n• Improved delivery.")).toEqual({
      summary: "Led architecture.",
      highlights: ["Improved delivery."]
    });
  });
});

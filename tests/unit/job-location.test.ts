import { describe, expect, it } from "vitest";
import { detectRelocation, extractLocationSignals } from "@/features/jobs/location";

const signals = (title: string, location: string | null, descriptionText = "") => extractLocationSignals({ title, location, descriptionText });

describe("extractLocationSignals: countries", () => {
  it("reads structured location and title", () => {
    expect(signals("Laravel Dev", "Remote/USA").countries).toEqual(["US"]);
    expect(signals("Full-Stack Developer (Laravel + Vue) - UK Only", "Remote/Hybrid, UK Only").countries).toEqual(["GB"]);
    expect(signals("Dev", "Remote / Prague, Czech Republic").countries).toEqual(["CZ"]);
    expect(signals("Dev", "Remote / Cyprus").countries).toEqual(["CY"]);
    expect(signals("Dev", "Remote / USA / Canada").countries).toEqual(["CA", "US"]);
  });

  it("reads countries from eligibility phrasing in the description", () => {
    expect(signals("Dev", "Remote", "Applicants must be located in Germany.").countries).toEqual(["DE"]);
    expect(signals("Dev", "Remote", "We are hiring in Sri Lanka and India.").countries).toEqual(["IN", "LK"]);
    expect(signals("Dev", "Remote", "This role is Australia-only.").countries).toEqual(["AU"]);
    expect(signals("Dev", "Remote", "Candidates from the United Kingdom are welcome.").countries).toEqual(["GB"]);
  });

  it("ignores incidental mentions and the pronoun 'us'", () => {
    expect(signals("Dev", "Remote", "Let us know if you have questions. Join us today. Our Germany office hosts an annual retreat.").countries).toEqual([]);
    expect(signals("Dev", null, "").countries).toEqual([]);
  });
});

describe("extractLocationSignals: regions and time zones", () => {
  it("normalises broad regions", () => {
    expect(signals("Dev", "Anywhere in the World").regions).toEqual(["worldwide"]);
    expect(signals("Dev", "Remote (EMEA)").regions).toEqual(["emea"]);
    expect(signals("Dev", "APAC or Asia-Pacific").regions).toEqual(["apac"]);
    expect(signals("Dev", "Remote, Europe").regions).toEqual(["europe"]);
    expect(signals("Dev", "North America").regions).toEqual(["north-america"]);
    expect(signals("Dev", "Remote", "Work from anywhere. Latin America welcome.").regions).toEqual(["latam", "worldwide"]);
  });

  it("extracts explicit time-zone constraints from the description", () => {
    expect(signals("Dev", "Remote", "Overlap with UTC-5 to UTC+1 required; core hours 9-5 EST.").timezones).toEqual(["EST", "UTC+1", "UTC-5"]);
    expect(signals("Dev", "Remote", "Must work GMT+2 hours, or CET.").timezones).toEqual(["CET", "GMT+2"]);
  });

  it("returns explicit empties when nothing is named", () => {
    expect(signals("Developer", "Remote", "We build great software.")).toEqual({ countries: [], regions: [], timezones: [] });
  });
});

describe("detectRelocation", () => {
  it("detects offered relocation independently of sponsorship", () => {
    for (const text of ["Includes a relocation package.", "We offer relocation assistance.", "Relocation is offered.", "relocation support available", "Help with relocation provided"]) {
      expect(detectRelocation(text), text).toBe("offered");
    }
  });

  it("detects explicitly unavailable relocation, which wins over an offered phrase", () => {
    for (const text of ["No relocation.", "Relocation is not available.", "We do not offer relocation.", "We cannot provide relocation support."]) {
      expect(detectRelocation(text), text).toBe("unavailable");
    }
  });

  it("does not infer relocation from vague wording", () => {
    for (const text of ["Relocation is possible for the right person.", "We are a relocation company.", "Remote worldwide.", ""]) {
      expect(detectRelocation(text), text).toBe("unknown");
    }
  });
});

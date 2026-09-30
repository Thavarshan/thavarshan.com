import { describe, expect, it } from "vitest";
import { parseSalary } from "@/lib/job-salary";

describe("parseSalary", () => {
  it("parses a full range with a trailing currency code", () => {
    expect(parseSalary("$134,450.00 - $167,258.30 USD")).toEqual({
      salaryMin: 134450,
      salaryMax: 167258.3,
      salaryCurrency: "USD",
      salaryPeriod: null
    });
  });

  it("parses an 'up to' figure with a currency symbol and k-suffix", () => {
    expect(parseSalary("Up to €100k")).toEqual({ salaryMin: null, salaryMax: 100000, salaryCurrency: "EUR", salaryPeriod: null });
  });

  it("parses a single k-suffixed point figure", () => {
    expect(parseSalary("£60k")).toEqual({ salaryMin: 60000, salaryMax: 60000, salaryCurrency: "GBP", salaryPeriod: null });
  });

  it("parses a range where only the first side carries a currency symbol", () => {
    expect(parseSalary("$48,000–90,000")).toEqual({ salaryMin: 48000, salaryMax: 90000, salaryCurrency: "USD", salaryPeriod: null });
  });

  it("treats 'Competitive' as unparseable", () => {
    expect(parseSalary("Competitive")).toEqual({ salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null });
  });

  it("treats an empty string as unparseable", () => {
    expect(parseSalary("")).toEqual({ salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null });
    expect(parseSalary(null)).toEqual({ salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null });
  });

  it("parses a range with a symbol on both sides", () => {
    expect(parseSalary("£45,000 - £55,000")).toEqual({ salaryMin: 45000, salaryMax: 55000, salaryCurrency: "GBP", salaryPeriod: null });
  });

  it("treats a trailing '+' as a minimum-only qualifier", () => {
    expect(parseSalary("$100k+")).toEqual({ salaryMin: 100000, salaryMax: null, salaryCurrency: "USD", salaryPeriod: null });
  });

  it("treats a leading 'From' as a minimum-only qualifier", () => {
    expect(parseSalary("From $80,000")).toEqual({ salaryMin: 80000, salaryMax: null, salaryCurrency: "USD", salaryPeriod: null });
  });

  it("never guesses a currency for a bare number", () => {
    expect(parseSalary("48000-90000")).toEqual({ salaryMin: 48000, salaryMax: 90000, salaryCurrency: null, salaryPeriod: null });
  });
});

describe("salary period", () => {
  it.each([
    ["$50/hr", "hour"],
    ["$50 per hour", "hour"],
    ["$400 a day", "day"],
    ["£3,000 per month", "month"],
    ["$5k/mo", "month"],
    ["$120,000 per year", "year"],
    ["€90k annually", "year"],
    ["$100k p.a.", "year"],
    ["$1,500 weekly", "week"]
  ])("detects %s as %s", (raw, period) => {
    expect(parseSalary(raw).salaryPeriod).toBe(period);
  });

  it("never assumes a period when the posting does not state one", () => {
    for (const raw of ["$100k", "$60,000 - $80,000", "Up to €100k", "Competitive", "", null]) {
      expect(parseSalary(raw).salaryPeriod).toBeNull();
    }
  });
});

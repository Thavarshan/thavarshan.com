import { describe, expect, it } from "vitest";
import { assessOpportunity, INELIGIBLE_SCORE_CAP, RELEVANCE_SCORE_CAP, isLaravelPhpRole } from "@/features/jobs/opportunities";

type Input = Parameters<typeof assessOpportunity>[0];

const laravelBase = { title: "Senior Laravel Engineer", tags: ["laravel", "react", "aws"] };

function assess(overrides: Partial<Input>) {
  return assessOpportunity({ descriptionText: "", location: "Remote", ...laravelBase, ...overrides });
}

describe("assessOpportunity test matrix", () => {
  it("worldwide remote is eligible and scores high", () => {
    const result = assess({ descriptionText: "Remote worldwide. Docker and AWS.", location: "Remote - Worldwide" });
    expect(result).toMatchObject({ eligibility: "eligible", workArrangement: "remote-worldwide" });
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("Sri Lanka eligible", () => {
    const result = assess({ descriptionText: "We hire in Sri Lanka." });
    expect(result).toMatchObject({ eligibility: "eligible", workArrangement: "remote-sri-lanka-eligible" });
  });

  it("EMEA-only wording stays unknown, never eligible", () => {
    const result = assess({ descriptionText: "Remote within EMEA time zones.", location: "Remote (EMEA)" });
    expect(result.eligibility).toBe("unknown");
    expect(result.concerns).toContain("Sri Lanka hiring eligibility is not explicit");
  });

  it("explicit US-only is ineligible and capped despite strong technical fit", () => {
    const result = assess({ descriptionText: "US-only. Laravel, Vue, AWS, Docker, senior lead.", location: "Remote/USA" });
    expect(result.eligibility).toBe("ineligible");
    expect(result.score).toBeLessThanOrEqual(INELIGIBLE_SCORE_CAP);
    expect(result.scoreBreakdown.at(-1)?.factor).toMatch(/Hard exclusion cap/);
  });

  it("conflicting signals: worldwide plus a country restriction is ineligible", () => {
    const result = assess({ descriptionText: "Work from anywhere! Must be located in Germany." });
    expect(result.eligibility).toBe("ineligible");
    expect(result.workArrangement).toBe("remote-regional-restricted");
    expect(result.score).toBeLessThanOrEqual(INELIGIBLE_SCORE_CAP);
  });

  it("sponsorship offered overrides a regional restriction", () => {
    const result = assess({ descriptionText: "UK-only, but we offer visa sponsorship.", location: "Remote/UK" });
    expect(result).toMatchObject({ eligibility: "eligible", sponsorship: "confirmed" });
    expect(result.reasons).toContain("Sponsorship or relocation is mentioned");
  });

  it("does not award the sponsorship bonus for 'no sponsorship' wording", () => {
    for (const phrase of ["No visa sponsorship.", "We do not sponsor visas.", "We are unable to sponsor.", "Sponsorship is not available."]) {
      const result = assess({ descriptionText: `${phrase} Remote worldwide.` });
      expect(result.sponsorship, phrase).toBe("unavailable");
      expect(result.reasons, phrase).not.toContain("Sponsorship or relocation is mentioned");
    }
  });

  it("does not invent sponsorship from generic relocation wording", () => {
    const result = assess({ descriptionText: "Relocation is possible for the right person." });
    expect(result.sponsorship).toBe("unknown");
    expect(result.eligibility).toBe("unknown");
  });

  it("relocation package earns fit points but not sponsorship", () => {
    const result = assess({ descriptionText: "Includes a relocation package." });
    expect(result.reasons).toContain("Sponsorship or relocation is mentioned");
    expect(result.sponsorship).toBe("unknown");
  });

  it("missing salary and missing location are tolerated", () => {
    const result = assess({ descriptionText: "Remote worldwide.", location: null });
    expect(result.eligibility).toBe("eligible");
    expect(result.concerns.some((c) => c.includes("Posting location"))).toBe(false);
  });

  it("non-remote location without sponsorship is penalized and flagged", () => {
    const result = assess({ location: "Springfield, MO" });
    expect(result.workArrangement).toBe("onsite-no-sponsorship");
    expect(result.scoreBreakdown).toContainEqual({ factor: "Eligibility concerns without sponsorship", points: -40 });
  });

  it("no technical-fit combination can lift an ineligible role above the cap", () => {
    const result = assess({
      title: "Principal Laravel Architect",
      descriptionText: "Australia-only. Laravel, React, Vue, Inertia, AWS, Kubernetes, remote, staff lead.",
      tags: ["laravel", "php", "vue", "react", "aws"]
    });
    expect(result.eligibility).toBe("ineligible");
    expect(result.score).toBeLessThanOrEqual(INELIGIBLE_SCORE_CAP);
  });
});

describe("score explainability", () => {
  it("breakdown sums to the score when unclamped and lists every applied factor", () => {
    const result = assess({ descriptionText: "Remote worldwide." });
    const sum = result.scoreBreakdown.reduce((total, entry) => total + entry.points, 0);
    expect(result.score).toBe(Math.min(100, Math.max(0, sum)));
    expect(result.scoreBreakdown[0]).toEqual({ factor: "Baseline", points: 10 });
    for (const reason of result.reasons) expect(result.scoreBreakdown.map((e) => e.factor)).toContain(reason);
  });

  it("is deterministic", () => {
    expect(assess({ descriptionText: "Remote worldwide." })).toEqual(assess({ descriptionText: "Remote worldwide." }));
  });
});

describe("confidence", () => {
  const longText = "Remote worldwide. ".padEnd(250, "We build Laravel products. ");

  it("is high when eligibility, location, body, seniority and tags are all explicit", () => {
    const result = assess({ descriptionText: longText });
    expect(result.confidence).toBe(100);
    expect(result.confidenceBreakdown.map((e) => e.points).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is low for a sparse posting with no explicit eligibility, location or tags", () => {
    const result = assessOpportunity({ title: "Developer", descriptionText: "Company: Acme.", location: null, tags: [] });
    expect(result.confidence).toBe(0);
    expect(result.eligibility).toBe("unknown");
  });

  it("penalises conflicting geography signals independently of fit", () => {
    const result = assess({ descriptionText: `${longText} Work from anywhere! Must be located in Germany.` });
    expect(result.confidenceBreakdown).toContainEqual({ factor: "Conflicting geography signals", points: -25 });
    expect(result.confidence).toBeLessThan(100);
  });

  it("does not change the fit score", () => {
    const sparse = assess({ descriptionText: "Remote worldwide." });
    const rich = assess({ descriptionText: longText });
    expect(rich.score).toBe(sparse.score);
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });
});

describe("Laravel/PHP relevance gate", () => {
  const boilerplate = "Work from anywhere. We match developers across stacks: React & Golang, PHP & Vue, Vue & Node.js, React & .NET. Remote worldwide, AWS.";

  it("caps a non-Laravel role whose posting only lists stacks as boilerplate", () => {
    const result = assessOpportunity({
      title: "Senior .NET Full-stack Developer",
      descriptionText: boilerplate,
      location: "Anywhere in the World",
      tags: ["react", "php", "vue", "laravel"]
    });
    expect(result.score).toBeLessThanOrEqual(RELEVANCE_SCORE_CAP);
    expect(result.concerns).toContain("Laravel/PHP is not central to this role");
    expect(result.scoreBreakdown.at(-1)?.factor).toMatch(/Relevance cap/);
    expect(result.eligibility).toBe("eligible");
  });

  it("discounts 'X & PHP' pairings from a marketplace stack list", () => {
    const lemon = "React & Golang, PHP & Vue, Angular & PHP, Symfony & React, React & PHP, Vue & Node.js, Laravel & Vue";
    expect(isLaravelPhpRole({ title: "Senior .NET Developer", descriptionText: lemon })).toBe(false);
    expect(isLaravelPhpRole({ title: "Engineer", descriptionText: "We use PHP daily. Our Laravel app is large. Livewire powers the UI." })).toBe(true);
  });

  it("does not cap when the stack is in the title", () => {
    const result = assessOpportunity({ title: "Senior PHP Engineer", descriptionText: boilerplate, location: "Remote", tags: [] });
    expect(result.score).toBeGreaterThan(RELEVANCE_SCORE_CAP);
    expect(result.concerns).not.toContain("Laravel/PHP is not central to this role");
  });

  it("does not cap when the body repeatedly centres on the stack", () => {
    const body = "Tech stack: PHP 8.2 and Laravel 12 power the platform. Livewire for the UI. Remote worldwide. Senior AWS.";
    const result = assessOpportunity({ title: "Product Lead", descriptionText: body, location: "Remote", tags: ["laravel"] });
    expect(result.concerns).not.toContain("Laravel/PHP is not central to this role");
  });

  it("trusts a Laravel-only source board even with a sparse description", () => {
    const input = { title: "Software Engineer", descriptionText: "Company: Acme.", location: "Remote", tags: ["laravel"] };
    expect(isLaravelPhpRole(input, { laravelCurated: true })).toBe(true);
    expect(isLaravelPhpRole(input)).toBe(false);
  });

  it("never lifts an already-capped role: relevance and ineligible caps compose to the lower one", () => {
    const result = assessOpportunity({ title: "Senior .NET Developer", descriptionText: `${boilerplate} US-only.`, location: "Remote", tags: [] });
    expect(result.eligibility).toBe("ineligible");
    expect(result.score).toBeLessThanOrEqual(INELIGIBLE_SCORE_CAP);
  });
});

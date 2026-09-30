import { describe, expect, it } from "vitest";
import { isUnusableScrape } from "@/scripts/jobs/enrichment";
import { normalizeLaravelNewsLinks } from "@/scripts/jobs/sources/laravel-news";

describe("normalizeLaravelNewsLinks", () => {
  it("uses the listing's own title and company and canonicalizes the URL", () => {
    const drafts = normalizeLaravelNewsLinks([
      { href: "https://larajobs.com/job/3925?utm_source=laravelnews&utm_medium=referral", title: "Web Application Developer", company: "University of Connecticut" }
    ]);
    expect(drafts).toEqual([{ canonicalUrl: "https://larajobs.com/job/3925", title: "Web Application Developer", company: "University of Connecticut" }]);
  });

  it("dedupes repeated links, collapses whitespace and tolerates a missing company", () => {
    const drafts = normalizeLaravelNewsLinks([
      { href: "https://larajobs.com/job/1?a=1", title: "  Senior\n  Engineer ", company: null },
      { href: "https://larajobs.com/job/1?b=2", title: "Other title", company: "Other" }
    ]);
    expect(drafts).toEqual([{ canonicalUrl: "https://larajobs.com/job/1", title: "Senior Engineer", company: null }]);
  });

  it("drops entries with no title or an invalid URL", () => {
    expect(normalizeLaravelNewsLinks([
      { href: "https://larajobs.com/job/2", title: "   ", company: "X" },
      { href: "not a url", title: "Real title", company: "X" }
    ])).toEqual([]);
  });
});

describe("isUnusableScrape", () => {
  it("rejects Cloudflare challenge and verification pages", () => {
    expect(isUnusableScrape({ title: "Additional Verification Required", description: "Your Ray ID for this request is a3f7c360 Enable JavaScript and cookies to continue" })).toBe(true);
    expect(isUnusableScrape({ title: "Just a moment...", description: "" })).toBe(true);
    expect(isUnusableScrape({ title: "Careers", description: "Checking your browser before accessing the site" })).toBe(true);
    expect(isUnusableScrape({ title: "Acme", description: "(function(){window._cf_chl_opt = {cFPWv: 'g'}})" })).toBe(true);
  });

  it("rejects region-block interstitials that would otherwise replace a real description", () => {
    expect(isUnusableScrape({ title: "Careers", description: "Compliance · Region restriction Careers are not available in your region." })).toBe(true);
    expect(isUnusableScrape({ title: "Jobs", description: "This content is not available in your country." })).toBe(true);
  });

  it("accepts ordinary job pages, including cookie-notice text", () => {
    expect(isUnusableScrape({ title: "Senior Laravel Developer", description: "Join our team. We build with Laravel and Vue." })).toBe(false);
    expect(isUnusableScrape({ title: "Web Application Developer", description: "Our websites may use cookies to personalize your experience. Responsibilities include..." })).toBe(false);
  });

  it("only inspects the start of long descriptions so a stray phrase deep in a posting is not fatal", () => {
    expect(isUnusableScrape({ title: "Engineer", description: `${"Great role. ".repeat(400)} Access denied to nobody.` })).toBe(false);
  });
});

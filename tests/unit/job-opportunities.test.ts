import { describe, expect, it } from "vitest";
import { assessOpportunity, canonicalizeJobUrl, mergeOpportunities, opportunityId, type Opportunity } from "@/lib/job-opportunities";
import { parseLaraJobsFeed } from "@/scripts/jobs/collect";

const now = "2026-09-22T00:00:00.000Z";

describe("job opportunity collection", () => {
  it("parses LaraJobs RSS records into the handoff schema", () => {
    const records = parseLaraJobsFeed(`<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[Senior Laravel Developer at Acme]]></title>
      <link>https://larajobs.com/job/123?utm_source=rss</link>
      <pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[Remote worldwide. Laravel, Vue.js and AWS.]]></description>
    </item></channel></rss>`, now);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      title: "Senior Laravel Developer",
      company: "Acme",
      canonicalUrl: "https://larajobs.com/job/123",
      eligibility: "eligible",
      sponsorship: "unknown"
    });
    expect(records[0].score).toBeGreaterThanOrEqual(80);
  });

  it("does not treat country-restricted remote work as eligible", () => {
    const assessment = assessOpportunity({
      title: "Senior Laravel Engineer - Remote USA Only",
      descriptionText: "Applicants must be located in the United States. We do not sponsor visas.",
      location: "Remote/USA",
      tags: ["laravel", "react"]
    });

    expect(assessment.eligibility).toBe("ineligible");
    expect(assessment.sponsorship).toBe("unavailable");
    expect(assessment.concerns).toContain("Restricted to the United States");
  });

  it("canonicalizes tracking URLs and preserves first-seen time", () => {
    const url = "https://larajobs.com/job/123?utm_source=news#apply";
    expect(canonicalizeJobUrl(url)).toBe("https://larajobs.com/job/123");
    expect(opportunityId(url)).toBe(opportunityId("https://larajobs.com/job/123"));

    const incoming = { id: opportunityId(url), firstSeenAt: now, lastSeenAt: now, score: 90, title: "Role" } as Opportunity;
    const previous = { ...incoming, firstSeenAt: "2026-09-01T00:00:00.000Z", score: 70 };
    expect(mergeOpportunities([previous], [incoming])[0].firstSeenAt).toBe(previous.firstSeenAt);
  });
});

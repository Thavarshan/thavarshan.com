import { describe, expect, it } from "vitest";
import { assessOpportunity } from "@/lib/job-opportunities";
import { parseLaraJobsFeed } from "@/scripts/jobs/sources/larajobs";

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
      sponsorship: "unknown",
      seniority: "senior",
      workArrangement: "remote-worldwide",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      status: "new"
    });
    expect(records[0].score).toBeGreaterThanOrEqual(80);
  });

  it("prefers the feed's structured job fields over guessing from the title", () => {
    const records = parseLaraJobsFeed(`<?xml version="1.0"?><rss><channel>
      <item>
        <title><![CDATA[Full-Stack Developer (Laravel + Vue/Inertia) - UK Only]]></title>
        <link>https://larajobs.com/job/3938</link>
        <pubDate>Tue, 22 Sep 2026 09:37:48 GMT</pubDate>
        <description><![CDATA[]]></description>
        <job:location><![CDATA[Remote/Hybrid, UK Only]]></job:location>
        <job:job_type><![CDATA[FULL_TIME]]></job:job_type>
        <job:salary><![CDATA[£60k]]></job:salary>
        <job:company><![CDATA[Greenwood Capital]]></job:company>
        <job:tags><![CDATA[API,Fullstack,Laravel,TailwindCSS,VueJS]]></job:tags>
      </item>
      <item>
        <title><![CDATA[Software Engineer]]></title>
        <link>https://larajobs.com/job/3929</link>
        <pubDate>Fri, 04 Sep 2026 12:37:22 GMT</pubDate>
        <description><![CDATA[]]></description>
        <job:location><![CDATA[Springfield, MO]]></job:location>
        <job:job_type><![CDATA[FULL_TIME]]></job:job_type>
        <job:salary><![CDATA[]]></job:salary>
        <job:company><![CDATA[Invo Solutions]]></job:company>
        <job:tags><![CDATA[Laravel,PHP,Postgres,React]]></job:tags>
      </item>
    </channel></rss>`, now);

    expect(records).toHaveLength(2);

    const ukJob = records.find((record) => record.canonicalUrl.endsWith("3938"))!;
    expect(ukJob.title).toBe("Full-Stack Developer (Laravel + Vue/Inertia) - UK Only");
    expect(ukJob.company).toBe("Greenwood Capital");
    expect(ukJob.location).toBe("Remote/Hybrid, UK Only");
    expect(ukJob.employmentType).toBe("Full-Time");
    expect(ukJob.salary).toBe("£60k");
    expect(ukJob.salaryMin).toBe(60000);
    expect(ukJob.salaryMax).toBe(60000);
    expect(ukJob.salaryCurrency).toBe("GBP");
    expect(ukJob.tags).toEqual(expect.arrayContaining(["laravel", "fullstack", "vuejs"]));
    expect(ukJob.eligibility).toBe("ineligible");
    expect(ukJob.workArrangement).toBe("remote-regional-restricted");

    const usJob = records.find((record) => record.canonicalUrl.endsWith("3929"))!;
    expect(usJob.company).toBe("Invo Solutions");
    expect(usJob.tags).toContain("laravel");
    expect(usJob.reasons).toContain("Laravel is explicitly required");
    expect(usJob.concerns).not.toContain("Laravel is not explicitly mentioned");
    expect(usJob.concerns.some((concern) => concern.includes("does not confirm remote-friendly hiring"))).toBe(true);
    expect(usJob.workArrangement).toBe("onsite-no-sponsorship");
    expect(usJob.salaryMin).toBeNull();
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
    expect(assessment.workArrangement).toBe("remote-regional-restricted");
  });

  it("treats an explicit Sri Lanka mention as eligible regardless of other restrictions", () => {
    const assessment = assessOpportunity({
      title: "Senior Laravel Engineer",
      descriptionText: "Open to candidates in Sri Lanka and the EU. Must be located in Europe otherwise.",
      location: "Remote",
      tags: ["laravel"]
    });

    expect(assessment.eligibility).toBe("eligible");
    expect(assessment.workArrangement).toBe("remote-sri-lanka-eligible");
  });
});

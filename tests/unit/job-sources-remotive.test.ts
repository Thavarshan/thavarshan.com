import { describe, expect, it } from "vitest";
import { parseRemotiveJobs } from "@/scripts/jobs/sources/remotive";

const now = "2026-09-23T00:00:00.000Z";

const relevantJob = {
  id: 1,
  url: "https://remotive.com/remote-jobs/laravel/senior-laravel-developer-1",
  title: "Senior Laravel Developer",
  company_name: "Acme Remote",
  category: "Software Development",
  tags: ["laravel", "php", "mysql", "vue"],
  job_type: "full_time",
  publication_date: "2026-09-18T16:43:22",
  candidate_required_location: "Worldwide",
  salary: "$90k - $120k",
  description: "<p>We need a senior Laravel developer.</p>"
};

// A company-wide tag dump: the title/description have nothing to do with Laravel, but the
// employer tags every listing with its entire tech stack (including "laravel" and "php").
const noisyIrrelevantJob = {
  id: 2,
  url: "https://remotive.com/remote-jobs/design/senior-qa-engineer-2",
  title: "Senior QA Engineer",
  company_name: "Big Co",
  category: "QA",
  tags: [".net", "android", "c", "c#", "c++", "golang", "ios", "java", "javascript", "node.js", "php", "python", "react", "laravel", "swift"],
  job_type: "full_time",
  publication_date: "2026-09-18T16:43:22",
  candidate_required_location: "USA",
  salary: "",
  description: "<p>Manual and automated testing.</p>"
};

describe("parseRemotiveJobs", () => {
  it("keeps a job whose title mentions Laravel and filters a noisy boilerplate-tagged one", () => {
    const { opportunities, skipped } = parseRemotiveJobs({ jobs: [relevantJob, noisyIrrelevantJob] }, now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].title).toBe("Senior Laravel Developer");
    expect(opportunities[0].company).toBe("Acme Remote");
    expect(opportunities[0].source).toBe("remotive");
    expect(opportunities[0].salaryMin).toBe(90000);
    expect(opportunities[0].salaryMax).toBe(120000);
    expect(skipped).toBe(1);
  });

  it("throws when the jobs array is missing or malformed", () => {
    expect(() => parseRemotiveJobs({}, now)).toThrow();
    expect(() => parseRemotiveJobs({ jobs: "not-an-array" }, now)).toThrow();
  });

  it("throws when the response is HTTP-ok but reports zero raw jobs", () => {
    expect(() => parseRemotiveJobs({ jobs: [] }, now)).toThrow();
  });

  it("does not throw when every raw job is legitimately filtered out by relevance", () => {
    expect(() => parseRemotiveJobs({ jobs: [noisyIrrelevantJob] }, now)).not.toThrow();
    const { opportunities, skipped } = parseRemotiveJobs({ jobs: [noisyIrrelevantJob] }, now);
    expect(opportunities).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("counts a malformed individual job as rejected without aborting the rest", () => {
    const malformed = { id: 3 } as Record<string, unknown>;
    const { opportunities, rejected } = parseRemotiveJobs({ jobs: [malformed, relevantJob] }, now);
    expect(rejected).toBe(1);
    expect(opportunities).toHaveLength(1);
  });
});

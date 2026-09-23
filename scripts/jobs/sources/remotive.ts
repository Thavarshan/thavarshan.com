import type { APIRequestContext } from "@playwright/test";
import type { Opportunity, SourceCollectionSuccess } from "../../../lib/job-opportunities";
import { buildOpportunity, isLaravelPhpRelevant, normalizeJobType } from "../opportunity-builder";
import { withRetry } from "../concurrency";

export const remotiveUrl = "https://remotive.com/api/remote-jobs?category=software-dev";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name?: string | null;
  category?: string | null;
  tags?: unknown;
  job_type?: string | null;
  publication_date?: string | null;
  candidate_required_location?: string | null;
  salary?: string | null;
  description?: string | null;
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseRemotiveJobs(json: unknown, now = new Date().toISOString()): { opportunities: Opportunity[]; skipped: number; rejected: number } {
  const jobs = (json as { jobs?: unknown })?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error("Remotive response is missing a `jobs` array — the API shape may have changed");
  }
  if (jobs.length === 0) {
    throw new Error("Remotive returned zero jobs for category=software-dev — this is unexpected for an HTTP-ok response");
  }

  const opportunities: Opportunity[] = [];
  let skipped = 0;
  let rejected = 0;

  for (const raw of jobs) {
    try {
      const job = raw as RemotiveJob;
      if (!job.url || !job.title) {
        rejected++;
        continue;
      }
      const tags = Array.isArray(job.tags) ? job.tags.map(String) : [];
      if (!isLaravelPhpRelevant({ title: job.title, tags, category: job.category })) {
        skipped++;
        continue;
      }

      opportunities.push(buildOpportunity({
        title: job.title,
        company: job.company_name ?? null,
        url: job.url,
        sourceUrl: remotiveUrl,
        description: job.description ?? "",
        publishedAt: safeDate(job.publication_date),
        source: "remotive",
        location: job.candidate_required_location ?? null,
        employmentType: normalizeJobType(job.job_type ?? ""),
        salary: job.salary || null,
        feedTags: tags
      }, now));
    } catch {
      rejected++;
    }
  }

  return { opportunities, skipped, rejected };
}

export async function collectRemotiveJobs(request: APIRequestContext, now = new Date().toISOString()): Promise<SourceCollectionSuccess> {
  const response = await withRetry(() => request.get(remotiveUrl), { retries: 2, baseDelayMs: 500 });
  if (!response.ok()) throw new Error(`Remotive API returned ${response.status()}`);
  const { opportunities, skipped, rejected } = parseRemotiveJobs(await response.json(), now);
  return { source: "remotive", opportunities, skipped, rejected };
}

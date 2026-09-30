import type { Opportunity } from "../../src/features/jobs/opportunities";

export const USER_AGENT = "JeromeJobCollector/1.0 (+https://thavarshan.com)";
/** Product token robots.txt groups are matched against. */
export const ROBOTS_AGENT = "JeromeJobCollector";

/** Minimum spacing between requests to the same host. */
export const MIN_HOST_INTERVAL_MS = 1_000;
/** Wall-clock budget for one source, including retries and enrichment; exceeding it marks the source failed. */
export const SOURCE_DEADLINE_MS = 6 * 60_000;
export const REQUEST_TIMEOUT_MS = 30_000;

export interface SourcePolicy {
  /** How the data is accessed, in the issue's preference order: API > RSS > JSON-LD > structured HTML. */
  method: "api" | "rss" | "structured-html";
  /** Documented constraints the collector must honour. */
  constraints: string;
  /**
   * URLs the source's owner publishes for programmatic use even though robots.txt disallows the
   * path (robots.txt targets crawlers). Each entry needs a documented justification and is
   * reviewed in the PR that adds it; the default is always to obey robots.txt.
   */
  robotsExemptions: Array<{ urlPrefix: string; justification: string }>;
}

export const sourcePolicies: Record<Opportunity["source"], SourcePolicy> = {
  larajobs: {
    method: "rss",
    constraints: "Public RSS feed; robots.txt allows everything. Each listing's redirect chain is followed hop-by-hop with a robots.txt check on every host before it is requested.",
    robotsExemptions: []
  },
  "laravel-news": {
    method: "structured-html",
    constraints: "Public home page listing (a[data-home-job]); robots.txt disallows only /api/ and /account/. Titles and companies come from the listing, never from scraped third-party pages.",
    robotsExemptions: []
  },
  remotive: {
    method: "api",
    constraints:
      "Public JSON API. Remotive states access is granted so developers can share its jobs further, asks for a link back to the Remotive URL and a mention of Remotive as the source (both kept via `source` + `canonicalUrl`), forbids submitting jobs to third-party job sites and using them to collect sign-ups, and asks for at most ~4 requests/day (we make 1).",
    robotsExemptions: [
      {
        urlPrefix: "https://remotive.com/api/remote-jobs",
        justification: "robots.txt disallows /api/*, but this is Remotive's documented public API (remotive.com/api-documentation) and its response body explicitly grants developer access under the conditions above."
      }
    ]
  },
  weworkremotely: {
    method: "rss",
    constraints: "Public RSS feed; robots.txt allows the category feed. One request per run.",
    robotsExemptions: []
  }
};

export function isRobotsExempt(source: Opportunity["source"], url: string): boolean {
  return sourcePolicies[source].robotsExemptions.some((entry) => url.startsWith(entry.urlPrefix));
}

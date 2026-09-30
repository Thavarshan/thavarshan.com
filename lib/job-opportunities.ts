import { createHash } from "node:crypto";
import { z } from "zod";
import {
  deriveSeniority,
  exclusionSignals,
  positiveSignals,
  remoteScopeConfirmationPattern,
  sriLankaMentionPattern,
  worldwideEligibilityPattern
} from "./job-eligibility-signals";

export const opportunitySchema = z.object({
  id: z.string().min(1),
  source: z.enum(["larajobs", "laravel-news", "remotive", "weworkremotely"]),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  company: z.string().nullable(),
  location: z.string().nullable(),
  workArrangement: z.enum([
    "remote-worldwide",
    "remote-sri-lanka-eligible",
    "remote-regional-restricted",
    "relocation-sponsorship",
    "onsite-no-sponsorship",
    "unknown"
  ]),
  employmentType: z.string().nullable(),
  seniority: z.enum(["junior", "mid", "senior", "lead", "unknown"]),
  salary: z.string().nullable(),
  salaryMin: z.number().nonnegative().nullable(),
  salaryMax: z.number().nonnegative().nullable(),
  salaryCurrency: z.string().nullable(),
  descriptionText: z.string(),
  tags: z.array(z.string()),
  contentFingerprint: z.string(),
  duplicateOfIds: z.array(z.string()),
  publishedAt: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  status: z.enum(["new", "active", "closed"]),
  closedAt: z.string().datetime().nullable(),
  eligibility: z.enum(["eligible", "ineligible", "unknown"]),
  sponsorship: z.enum(["confirmed", "unavailable", "unknown"]),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  concerns: z.array(z.string()),
  scoreBreakdown: z.array(z.object({ factor: z.string(), points: z.number().int() })).default([]),
  /** 0–100 confidence in the extracted signals (not the fit itself); null for snapshots written before it existed. */
  confidence: z.number().int().min(0).max(100).nullable().default(null),
  confidenceBreakdown: z.array(z.object({ factor: z.string(), points: z.number().int() })).default([])
});

export const opportunitySnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.string().datetime(),
  candidate: z.object({
    location: z.literal("Sri Lanka"),
    preferredStack: z.array(z.string()),
    experienceYears: z.literal(11),
    workModes: z.array(z.enum(["remote", "relocation-with-sponsorship"]))
  }),
  sources: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    collectedAt: z.string().datetime(),
    status: z.enum(["ok", "failed"]),
    recordsFound: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    error: z.string().nullable()
  })),
  opportunities: z.array(opportunitySchema)
});

export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunitySnapshot = z.infer<typeof opportunitySnapshotSchema>;
export type SourceStats = { added: number; updated: number; unchanged: number; closed: number; pruned: number };

export type SourceCollectionSuccess = { source: Opportunity["source"]; opportunities: Opportunity[]; skipped: number; rejected: number };
export type SourceCollectionFailure = { source: Opportunity["source"]; failed: true; error: string };
export type SourceCollectionOutcome = SourceCollectionSuccess | SourceCollectionFailure;

export function canonicalizeJobUrl(input: string) {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function opportunityId(url: string) {
  return createHash("sha256").update(canonicalizeJobUrl(url)).digest("hex").slice(0, 20);
}

function normalizeForFingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|corp|corporation|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function computeContentFingerprint(company: string | null | undefined, title: string) {
  const normalizedCompany = company ? normalizeForFingerprint(company) : "";
  const normalizedTitle = normalizeForFingerprint(title);
  return createHash("sha256").update(`${normalizedCompany}|${normalizedTitle}`).digest("hex").slice(0, 20);
}

/** Ineligible roles are hard-excluded: technical-fit points must never lift them into the ranked range. */
export const INELIGIBLE_SCORE_CAP = 20;

const sponsorshipUnavailablePattern =
  /\b(?:no|without) (?:visa )?sponsorship\b|\bdo(?:es)? not (?:offer |provide )?(?:visa )?sponsor(?:ship)?\b|\b(?:cannot|can't|unable to|will not|won't) (?:offer |provide )?(?:visa )?sponsor(?:ship)?\b|\bsponsorship (?:is )?(?:not (?:available|offered|provided)|unavailable)\b/i;

function categorizeWorkArrangement(input: {
  eligibility: Opportunity["eligibility"];
  sriLankaMentioned: boolean;
  worldwideMatched: boolean;
  sponsorship: Opportunity["sponsorship"];
  concerns: string[];
}): Opportunity["workArrangement"] {
  if (input.sriLankaMentioned) return "remote-sri-lanka-eligible";
  if (input.eligibility === "ineligible") return "remote-regional-restricted";
  if (input.worldwideMatched) return "remote-worldwide";
  if (input.sponsorship === "confirmed") return "relocation-sponsorship";
  if (input.concerns.some((concern) => concern.includes("does not confirm remote-friendly hiring"))) return "onsite-no-sponsorship";
  if (input.concerns.some((concern) => concern.startsWith("Restricted"))) return "remote-regional-restricted";
  return "unknown";
}

export const SUBSTANTIVE_DESCRIPTION_LENGTH = 200;

/** Roles that aren't demonstrably Laravel/PHP work can't out-rank real fits on seniority/remote/cloud points alone. */
export const RELEVANCE_SCORE_CAP = 35;
const stackPattern = /\b(laravel|php|livewire|lumen|symfony)\b/i;
const stackMentionPattern = /\b(laravel|php|livewire|lumen|symfony)\b/gi;
const MIN_DESCRIPTION_STACK_MENTIONS = 3;

/**
 * A bare mention isn't evidence: agency/marketplace postings (e.g. Lemon.io) list every stack they
 * hire for ("PHP & Vue, React & .NET…"). Role-specific evidence is the stack in the title, repeated
 * non-list mentions in the body, or a Laravel-only source board.
 */
export function isLaravelPhpRole(input: { title: string; descriptionText: string }, options: { laravelCurated?: boolean } = {}) {
  if (options.laravelCurated) return true;
  if (stackPattern.test(input.title)) return true;
  // Discount "X & PHP" / "Laravel & Y" pairings: that is how marketplaces enumerate every stack they staff.
  const withoutPairings = input.descriptionText
    .replace(/\b[\w.#+/]+\s*&\s*(?:laravel|php|livewire|lumen|symfony)\b/gi, "")
    .replace(/\b(?:laravel|php|livewire|lumen|symfony)\s*&\s*[\w.#+/]+/gi, "");
  return (withoutPairings.match(stackMentionPattern) ?? []).length >= MIN_DESCRIPTION_STACK_MENTIONS;
}

/**
 * Confidence measures how well-evidenced the extracted signals are, independent of fit: an explicit
 * eligibility statement, a stated location, a real posting body (not a synthetic feed summary),
 * a detectable seniority and tech tags each add evidence; contradictory geography subtracts.
 */
function assessConfidence(input: {
  eligibility: Opportunity["eligibility"];
  location: string | null;
  descriptionText: string;
  seniority: Opportunity["seniority"];
  tags: string[];
  conflicting: boolean;
}) {
  const breakdown: Opportunity["confidenceBreakdown"] = [];
  if (input.eligibility !== "unknown") breakdown.push({ factor: "Eligibility is explicit in the posting", points: 35 });
  if (input.location) breakdown.push({ factor: "Location is stated", points: 20 });
  if (input.descriptionText.length >= SUBSTANTIVE_DESCRIPTION_LENGTH) breakdown.push({ factor: "Posting has a substantive description", points: 20 });
  if (input.seniority !== "unknown") breakdown.push({ factor: "Seniority is stated", points: 15 });
  if (input.tags.length > 0) breakdown.push({ factor: "Technology tags are present", points: 10 });
  if (input.conflicting) breakdown.push({ factor: "Conflicting geography signals", points: -25 });
  const total = breakdown.reduce((sum, entry) => sum + entry.points, 0);
  return { confidence: Math.max(0, Math.min(100, total)), confidenceBreakdown: breakdown };
}

export function assessOpportunity(
  input: Pick<Opportunity, "title" | "descriptionText" | "location" | "tags">,
  options: { laravelCurated?: boolean } = {}
) {
  const text = [input.title, input.location, input.descriptionText, ...input.tags].filter(Boolean).join("\n");
  const reasons: string[] = [];
  const concerns: string[] = [];
  const scoreBreakdown: Opportunity["scoreBreakdown"] = [{ factor: "Baseline", points: 10 }];

  const sponsorship = sponsorshipUnavailablePattern.test(text)
    ? "unavailable" as const
    : /\b(?:visa )?sponsor(?:ship|ed)?\b/i.test(text)
      ? "confirmed" as const
      : "unknown" as const;

  for (const [pattern, points, reason] of positiveSignals) {
    // "no sponsorship" mentions the keyword but must not earn the sponsorship bonus.
    if (sponsorship === "unavailable" && reason.startsWith("Sponsorship")) continue;
    if (pattern.test(text)) {
      scoreBreakdown.push({ factor: reason, points });
      reasons.push(reason);
    }
  }

  for (const [pattern, concern] of exclusionSignals) {
    if (pattern.test(text)) concerns.push(concern);
  }

  if (input.location && !remoteScopeConfirmationPattern.test(input.location)) {
    concerns.push(`Posting location (${input.location}) does not confirm remote-friendly hiring`);
  }

  const sriLankaMentioned = sriLankaMentionPattern.test(text);
  const worldwideMatched = worldwideEligibilityPattern.test(text);

  if (concerns.length > 0 && sponsorship !== "confirmed" && !sriLankaMentioned) {
    scoreBreakdown.push({ factor: "Eligibility concerns without sponsorship", points: -40 });
  }
  if (!/\blaravel\b/i.test(text)) concerns.push("Laravel is not explicitly mentioned");

  const eligibility = sriLankaMentioned
    ? "eligible" as const
    : concerns.some((concern) => concern.startsWith("Restricted")) && sponsorship !== "confirmed"
      ? "ineligible" as const
      : worldwideMatched || sponsorship === "confirmed"
        ? "eligible" as const
        : "unknown" as const;

  if (eligibility === "unknown") concerns.push("Sri Lanka hiring eligibility is not explicit");

  let score = scoreBreakdown.reduce((total, entry) => total + entry.points, 0);
  score = Math.max(0, Math.min(100, score));
  if (!isLaravelPhpRole(input, options)) {
    concerns.push("Laravel/PHP is not central to this role");
    if (score > RELEVANCE_SCORE_CAP) {
      scoreBreakdown.push({ factor: "Relevance cap (not a Laravel/PHP role)", points: RELEVANCE_SCORE_CAP - score });
      score = RELEVANCE_SCORE_CAP;
    }
  }
  if (eligibility === "ineligible" && score > INELIGIBLE_SCORE_CAP) {
    scoreBreakdown.push({ factor: "Hard exclusion cap (ineligible)", points: INELIGIBLE_SCORE_CAP - score });
    score = INELIGIBLE_SCORE_CAP;
  }

  const seniority = deriveSeniority(text);
  const workArrangement = categorizeWorkArrangement({ eligibility, sriLankaMentioned, worldwideMatched, sponsorship, concerns });

  const conflicting = worldwideMatched && concerns.some((concern) => concern.startsWith("Restricted"));
  const { confidence, confidenceBreakdown } = assessConfidence({
    eligibility, location: input.location, descriptionText: input.descriptionText, seniority, tags: input.tags, conflicting
  });

  return {
    eligibility,
    sponsorship,
    score,
    scoreBreakdown,
    confidence,
    confidenceBreakdown,
    reasons: [...new Set(reasons)],
    concerns: [...new Set(concerns)],
    seniority,
    workArrangement
  };
}

function applyDuplicateFingerprints(opportunities: Opportunity[]) {
  const byFingerprint = new Map<string, Opportunity[]>();
  for (const item of opportunities) {
    if (!item.contentFingerprint) continue;
    const group = byFingerprint.get(item.contentFingerprint) ?? [];
    group.push(item);
    byFingerprint.set(item.contentFingerprint, group);
  }

  for (const group of byFingerprint.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const others = group.filter((other) => other.id !== item.id && other.source !== item.source);
      if (others.length > 0) item.duplicateOfIds = [...new Set(others.map((other) => other.id))];
    }
  }
}

export function mergeOpportunities(
  existing: Opportunity[],
  results: SourceCollectionOutcome[],
  now: string,
  retentionDays = 30
): { opportunities: Opportunity[]; stats: Record<string, SourceStats> } {
  const bySource = new Map<Opportunity["source"], Opportunity[]>();
  for (const item of existing) {
    const list = bySource.get(item.source) ?? [];
    list.push(item);
    bySource.set(item.source, list);
  }

  const merged = new Map<string, Opportunity>();
  const stats: Record<string, SourceStats> = {};
  const attemptedSources = new Set<Opportunity["source"]>();

  for (const result of results) {
    attemptedSources.add(result.source);
    const stat: SourceStats = { added: 0, updated: 0, unchanged: 0, closed: 0, pruned: 0 };
    stats[result.source] = stat;
    const existingForSource = bySource.get(result.source) ?? [];
    const existingById = new Map(existingForSource.map((item) => [item.id, item]));

    if ("failed" in result) {
      for (const item of existingForSource) merged.set(item.id, { ...item });
      continue;
    }

    const incomingIds = new Set(result.opportunities.map((item) => item.id));

    for (const item of result.opportunities) {
      const previous = existingById.get(item.id);
      if (!previous) {
        merged.set(item.id, { ...item, status: "new", firstSeenAt: now, lastSeenAt: now, closedAt: null });
        stat.added++;
        continue;
      }

      const changed =
        previous.descriptionText !== item.descriptionText ||
        previous.score !== item.score ||
        previous.title !== item.title ||
        previous.company !== item.company ||
        previous.salary !== item.salary;

      merged.set(item.id, { ...item, firstSeenAt: previous.firstSeenAt, lastSeenAt: now, status: "active", closedAt: null });
      if (changed) stat.updated++;
      else stat.unchanged++;
    }

    for (const item of existingForSource) {
      if (incomingIds.has(item.id)) continue;

      if (item.status === "closed") {
        const closedAtMs = item.closedAt ? new Date(item.closedAt).getTime() : null;
        const ageDays = closedAtMs !== null ? (new Date(now).getTime() - closedAtMs) / 86_400_000 : 0;
        if (closedAtMs !== null && ageDays > retentionDays) {
          stat.pruned++;
          continue;
        }
        merged.set(item.id, { ...item });
        continue;
      }

      merged.set(item.id, { ...item, status: "closed", closedAt: now });
      stat.closed++;
    }
  }

  for (const [source, items] of bySource) {
    if (attemptedSources.has(source)) continue;
    for (const item of items) merged.set(item.id, { ...item });
  }

  const opportunities = [...merged.values()];
  applyDuplicateFingerprints(opportunities);
  opportunities.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return { opportunities, stats };
}

import type { Opportunity } from "./job-opportunities";

export const reviewStatuses = ["new", "reviewed", "shortlisted", "dismissed"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export interface ReviewEntry {
  status: ReviewStatus;
  note: string;
  updatedAt: string;
}

export type ReviewMap = Record<string, ReviewEntry>;

export const NOTE_MAX_LENGTH = 500;
export const OPPORTUNITY_ID_PATTERN = /^[a-f0-9]{20}$/;

const eligibilityOrder: Record<Opportunity["eligibility"], number> = { eligible: 0, unknown: 1, ineligible: 2 };

export interface ReviewFilters {
  eligibility: Opportunity["eligibility"][];
  minScore: number;
  source: string;
  tech: string;
  arrangement: string;
  sponsorship: string;
  salary: "any" | "listed";
  maxAgeDays: number | null;
  review: ReviewStatus | "open" | "all";
  includeClosed: boolean;
}

export const defaultFilters: ReviewFilters = {
  eligibility: ["eligible", "unknown"],
  minScore: 0,
  source: "",
  tech: "",
  arrangement: "",
  sponsorship: "",
  salary: "any",
  maxAgeDays: null,
  review: "open",
  includeClosed: false
};

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/** Parses untrusted query parameters into a fully validated filter set; anything unrecognised falls back to defaults. */
export function parseFilters(params: URLSearchParams): ReviewFilters {
  const eligibility = params.getAll("elig").filter((value): value is Opportunity["eligibility"] => value in eligibilityOrder);
  const salary = params.get("sal") === "listed" ? "listed" : "any";
  const review = params.get("review");
  const age = params.get("age");

  return {
    eligibility: params.has("submitted") ? eligibility : defaultFilters.eligibility,
    minScore: clampInt(params.get("min"), 0, 100, 0),
    source: (params.get("src") ?? "").slice(0, 40),
    tech: (params.get("tech") ?? "").trim().toLowerCase().slice(0, 40),
    arrangement: (params.get("arr") ?? "").slice(0, 40),
    sponsorship: (params.get("spons") ?? "").slice(0, 20),
    salary,
    maxAgeDays: age ? clampInt(age, 1, 365, 30) : null,
    review: review === "all" || review === "open" || (reviewStatuses as readonly string[]).includes(review ?? "")
      ? (review as ReviewFilters["review"])
      : "open",
    includeClosed: params.get("closed") === "1"
  };
}

export function opportunityAgeDays(item: Pick<Opportunity, "publishedAt" | "firstSeenAt">, now: Date) {
  const reference = new Date(item.publishedAt ?? item.firstSeenAt).getTime();
  return Math.max(0, Math.floor((now.getTime() - reference) / 86_400_000));
}

export function reviewStatusOf(reviews: ReviewMap, id: string): ReviewStatus {
  return reviews[id]?.status ?? "new";
}

export function filterOpportunities(items: Opportunity[], filters: ReviewFilters, reviews: ReviewMap, now: Date) {
  return items.filter((item) => {
    if (!filters.includeClosed && item.status === "closed") return false;
    if (!filters.eligibility.includes(item.eligibility)) return false;
    if (item.score < filters.minScore) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.tech && !item.tags.some((tag) => tag.includes(filters.tech))) return false;
    if (filters.arrangement && item.workArrangement !== filters.arrangement) return false;
    if (filters.sponsorship && item.sponsorship !== filters.sponsorship) return false;
    if (filters.salary === "listed" && item.salaryMin === null && item.salaryMax === null) return false;
    if (filters.maxAgeDays !== null && opportunityAgeDays(item, now) > filters.maxAgeDays) return false;

    const status = reviewStatusOf(reviews, item.id);
    if (filters.review === "open") return status !== "dismissed";
    if (filters.review === "all") return true;
    return status === filters.review;
  });
}

/** Eligible first, then fit score, then freshness. (The dataset carries no confidence signal yet.) */
export function sortOpportunities(items: Opportunity[]) {
  return [...items].sort(
    (a, b) =>
      eligibilityOrder[a.eligibility] - eligibilityOrder[b.eligibility] ||
      b.score - a.score ||
      new Date(b.publishedAt ?? b.firstSeenAt).getTime() - new Date(a.publishedAt ?? a.firstSeenAt).getTime() ||
      a.title.localeCompare(b.title)
  );
}

/** Only http(s) links may be rendered as hrefs; scraped URLs are untrusted. */
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isStale(generatedAt: string, now: Date, maxHours = 48) {
  return now.getTime() - new Date(generatedAt).getTime() > maxHours * 3_600_000;
}

export function sanitizeNote(value: unknown): string {
  if (typeof value !== "string") return "";
  // Drop control characters other than tab/newline/carriage return.
  const cleaned = [...value].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10 || code === 13;
  });
  return cleaned.join("").trim().slice(0, NOTE_MAX_LENGTH);
}

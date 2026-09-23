import { createHash } from "node:crypto";
import { z } from "zod";

export const opportunitySchema = z.object({
  id: z.string().min(1),
  source: z.enum(["larajobs", "laravel-news"]),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  company: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  salary: z.string().nullable(),
  descriptionText: z.string(),
  tags: z.array(z.string()),
  publishedAt: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  eligibility: z.enum(["eligible", "ineligible", "unknown"]),
  sponsorship: z.enum(["confirmed", "unavailable", "unknown"]),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  concerns: z.array(z.string())
});

export const opportunitySnapshotSchema = z.object({
  schemaVersion: z.literal(1),
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
    recordsFound: z.number().int().nonnegative()
  })),
  opportunities: z.array(opportunitySchema)
});

export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunitySnapshot = z.infer<typeof opportunitySnapshotSchema>;

const positiveSignals: Array<[RegExp, number, string]> = [
  [/\blaravel\b/i, 30, "Laravel is explicitly required"],
  [/\b(senior|lead|principal|staff|architect)\b/i, 18, "Seniority matches an experienced developer"],
  [/\b(react|vue(?:\.js)?|inertia)\b/i, 12, "Frontend stack matches React/Vue/Inertia"],
  [/\b(aws|cloud|docker|kubernetes)\b/i, 8, "Cloud experience is relevant"],
  [/\b(remote|distributed|work from anywhere|worldwide)\b/i, 12, "Remote work is mentioned"],
  [/\b(visa sponsorship|sponsor(?:ship|ed)?|relocation package)\b/i, 10, "Sponsorship or relocation is mentioned"]
];

const exclusionSignals: Array<[RegExp, string]> = [
  [/\b(us|usa|united states)[ -]only\b|\bmust (?:be )?(?:based|located) in (?:the )?(?:us|usa|united states)\b/i, "Restricted to the United States"],
  [/\b(uk|united kingdom)[ -]only\b|\bright to work in (?:the )?(?:uk|united kingdom)\b/i, "Restricted to candidates with UK work authorization"],
  [/\b(eu|europe)[ -]only\b|\bmust (?:be )?(?:based|located) in (?:the )?(?:eu|europe)\b/i, "Restricted to Europe"],
  [/\bcanada[ -]only\b|\bmust (?:be )?(?:based|located) in canada\b/i, "Restricted to Canada"]
];

export function canonicalizeJobUrl(input: string) {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function opportunityId(url: string) {
  return createHash("sha256").update(canonicalizeJobUrl(url)).digest("hex").slice(0, 20);
}

export function assessOpportunity(input: Pick<Opportunity, "title" | "descriptionText" | "location" | "tags">) {
  const text = [input.title, input.location, input.descriptionText, ...input.tags].filter(Boolean).join("\n");
  const reasons: string[] = [];
  const concerns: string[] = [];
  let score = 10;

  for (const [pattern, points, reason] of positiveSignals) {
    if (pattern.test(text)) {
      score += points;
      reasons.push(reason);
    }
  }

  for (const [pattern, concern] of exclusionSignals) {
    if (pattern.test(text)) concerns.push(concern);
  }

  if (input.location && !/\b(remote|worldwide|anywhere|distributed)\b/i.test(input.location)) {
    concerns.push(`Posting location (${input.location}) does not confirm remote-friendly hiring`);
  }

  const sponsorship = /\b(?:no|without) (?:visa )?sponsorship\b|\bdo not sponsor\b/i.test(text)
    ? "unavailable" as const
    : /\b(?:visa )?sponsor(?:ship|ed)?\b/i.test(text)
      ? "confirmed" as const
      : "unknown" as const;

  if (concerns.length > 0 && sponsorship !== "confirmed") score -= 40;
  if (!/\blaravel\b/i.test(text)) concerns.push("Laravel is not explicitly mentioned");

  const eligibility = concerns.some((concern) => concern.startsWith("Restricted")) && sponsorship !== "confirmed"
    ? "ineligible" as const
    : /\b(worldwide|work from anywhere|anywhere in the world)\b/i.test(text) || sponsorship === "confirmed"
      ? "eligible" as const
      : "unknown" as const;

  if (eligibility === "unknown") concerns.push("Sri Lanka hiring eligibility is not explicit");

  return {
    eligibility,
    sponsorship,
    score: Math.max(0, Math.min(100, score)),
    reasons: [...new Set(reasons)],
    concerns: [...new Set(concerns)]
  };
}

export function mergeOpportunities(current: Opportunity[], incoming: Opportunity[]) {
  const existing = new Map(current.map((item) => [item.id, item]));
  const merged = new Map<string, Opportunity>();

  for (const item of incoming) {
    const previous = existing.get(item.id);
    merged.set(item.id, { ...item, firstSeenAt: previous?.firstSeenAt ?? item.firstSeenAt });
  }

  return [...merged.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

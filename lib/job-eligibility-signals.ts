/**
 * Broader signal is intentionally used for scoring ("remote work is mentioned") and for the
 * "does this posting confirm remote-friendly hiring" concern check. It is deliberately looser
 * than {@link worldwideEligibilityPattern} below, which gates outright eligibility and must not
 * fire on a bare "remote" mention alone (e.g. "Remote/USA" is remote-friendly but not worldwide).
 */
export const remoteScopeConfirmationPattern = /\b(remote|distributed|worldwide|anywhere|apac|asia[ -]pacific)\b/i;

export const worldwideEligibilityPattern = /\b(worldwide|work from anywhere|anywhere in the world|apac|asia[ -]pacific)\b/i;

export const sriLankaMentionPattern = /\bsri lanka\b/i;

export const positiveSignals: Array<[RegExp, number, string]> = [
  [/\blaravel\b/i, 30, "Laravel is explicitly required"],
  [/\b(senior|lead|principal|staff|architect)\b/i, 18, "Seniority matches an experienced developer"],
  [/\b(react|vue(?:\.js)?|inertia)\b/i, 12, "Frontend stack matches React/Vue/Inertia"],
  [/\b(aws|cloud|docker|kubernetes)\b/i, 8, "Cloud experience is relevant"],
  [remoteScopeConfirmationPattern, 12, "Remote work is mentioned"],
  [/\b(visa sponsorship|sponsor(?:ship|ed)?|relocation package)\b/i, 10, "Sponsorship or relocation is mentioned"],
  [sriLankaMentionPattern, 25, "Sri Lanka is explicitly mentioned"]
];

interface RestrictedRegion {
  label: string;
  aliases: string[];
}

// Bare 2-3 letter aliases are only safe when they're ordinary English words nobody would
// otherwise write in these exact templates (e.g. "us-only", "must be located in the us").
// A word as common as "in" (India) fails that test even template-anchored, so it's deliberately
// left out below — only the full country name is matched for India.
const restrictedRegions: RestrictedRegion[] = [
  { label: "the United States", aliases: ["us", "usa", "united states"] },
  { label: "candidates with UK work authorization", aliases: ["uk", "united kingdom"] },
  { label: "Europe", aliases: ["eu", "europe"] },
  { label: "Canada", aliases: ["canada"] },
  { label: "Australia", aliases: ["australia"] },
  { label: "Germany", aliases: ["germany"] },
  { label: "the Netherlands", aliases: ["netherlands"] },
  { label: "Ireland", aliases: ["ireland"] },
  { label: "India", aliases: ["india"] },
  { label: "Singapore", aliases: ["singapore"] },
  { label: "New Zealand", aliases: ["new zealand"] },
  { label: "France", aliases: ["france"] },
  { label: "Spain", aliases: ["spain"] },
  { label: "Poland", aliases: ["poland"] },
  { label: "Brazil", aliases: ["brazil"] },
  { label: "Mexico", aliases: ["mexico"] },
  { label: "South Africa", aliases: ["south africa"] },
  { label: "the UAE", aliases: ["uae", "united arab emirates", "dubai"] },
  { label: "the Philippines", aliases: ["philippines"] }
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRestrictedRegionPattern(aliases: string[]): RegExp {
  const group = aliases.map(escapeRegExp).join("|");
  return new RegExp(
    `\\b(?:${group})[ -]only\\b` +
      `|\\bmust (?:be )?(?:based|located) in (?:the )?(?:${group})\\b` +
      `|\\bright to work in (?:the )?(?:${group})\\b`,
    "i"
  );
}

export const exclusionSignals: Array<[RegExp, string]> = restrictedRegions.map((region) => [
  buildRestrictedRegionPattern(region.aliases),
  `Restricted to ${region.label}`
]);

export type Seniority = "junior" | "mid" | "senior" | "lead" | "unknown";

export function deriveSeniority(text: string): Seniority {
  if (/\bjunior\b|\bentry[ -]level\b/i.test(text)) return "junior";
  if (/\b(lead|principal|staff|architect)\b/i.test(text)) return "lead";
  if (/\b(senior|sr\.?)\b/i.test(text)) return "senior";
  if (/\b(mid|intermediate)\b/i.test(text)) return "mid";
  return "unknown";
}

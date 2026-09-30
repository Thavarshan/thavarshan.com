/**
 * Deterministic extraction of the geography a posting NAMES: countries (ISO 3166-1 alpha-2), broad
 * regions, time-zone constraints and relocation support. "Named" is not "eligible": a posting
 * that says "US-only" and one that says "open to Canada" both name a country. Eligibility is
 * decided separately (lib/job-opportunities.ts); these fields exist so reviewers and future
 * filters can see exactly which places a posting mentions, with explicit empties when it names none.
 */
export type Relocation = "offered" | "unavailable" | "unknown";

interface CountryDef {
  code: string;
  /** Matched case-insensitively as whole words. */
  names: string[];
  /** Matched case-sensitively as whole words (e.g. "US", "UK" — too ambiguous when case-folded). */
  abbreviations?: string[];
}

const countries: CountryDef[] = [
  { code: "US", names: ["united states", "usa", "u.s.a."], abbreviations: ["US", "U.S."] },
  { code: "GB", names: ["united kingdom", "england", "scotland", "wales", "great britain"], abbreviations: ["UK", "U.K."] },
  { code: "CA", names: ["canada"] },
  { code: "AU", names: ["australia"] },
  { code: "NZ", names: ["new zealand"] },
  { code: "DE", names: ["germany"] },
  { code: "NL", names: ["netherlands", "holland"] },
  { code: "IE", names: ["ireland"] },
  { code: "FR", names: ["france"] },
  { code: "ES", names: ["spain"] },
  { code: "PL", names: ["poland"] },
  { code: "PT", names: ["portugal"] },
  { code: "IT", names: ["italy"] },
  { code: "SE", names: ["sweden"] },
  { code: "CH", names: ["switzerland"] },
  { code: "CZ", names: ["czech republic", "czechia"] },
  { code: "CY", names: ["cyprus"] },
  { code: "IN", names: ["india"] },
  { code: "LK", names: ["sri lanka"] },
  { code: "SG", names: ["singapore"] },
  { code: "PH", names: ["philippines"] },
  { code: "AE", names: ["united arab emirates", "dubai"], abbreviations: ["UAE"] },
  { code: "ZA", names: ["south africa"] },
  { code: "BR", names: ["brazil"] },
  { code: "MX", names: ["mexico"] }
];

interface RegionDef {
  region: string;
  patterns: RegExp[];
  /**
   * "anywhere": specific enough to trust anywhere in the description. "cue": common in incidental
   * prose ("our European customers"), so only counted in the title/location or an eligibility phrase.
   */
  scope: "anywhere" | "cue";
}

const regions: RegionDef[] = [
  { region: "worldwide", patterns: [/\b(?:worldwide|work from anywhere|anywhere in the world|global(?:ly)? remote|fully global)\b/i], scope: "anywhere" },
  { region: "emea", patterns: [/\bEMEA\b/], scope: "anywhere" },
  { region: "apac", patterns: [/\b(?:APAC|asia[ -]pacific)\b/i], scope: "anywhere" },
  // "EU" is only a region when written in capitals; case-folded it would match ordinary words.
  { region: "europe", patterns: [/\beurope(?:an)?\b/i, /\bEuropean Union\b/i, /\bEU\b/], scope: "cue" },
  { region: "north-america", patterns: [/\bnorth america(?:n)?\b/i], scope: "cue" },
  { region: "latam", patterns: [/\blatin america\b/i, /\bLATAM\b/], scope: "anywhere" },
  { region: "asia", patterns: [/\b(?:south asia|southeast asia|south-east asia)\b/i], scope: "cue" }
];

const timezonePatterns: RegExp[] = [
  /\bUTC\s?[+\-−]\s?\d{1,2}(?::?\d{2})?\b/g,
  /\bGMT\s?[+\-−]\s?\d{1,2}(?::?\d{2})?\b/g,
  // A bare name is skipped when it is really the start of an offset ("UTC-5"), which the patterns above capture.
  /\b(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST|EET|EEST|BST|IST|GMT|UTC|AEST|AEDT|NZST|SGT|JST)\b(?!\s?[+\-−]\s?\d)/g
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordMatch(text: string, term: string, caseSensitive: boolean) {
  return new RegExp(`(?<![\\w])${escapeRegExp(term)}(?![\\w])`, caseSensitive ? "" : "i").test(text);
}

function countriesIn(text: string): string[] {
  const found: string[] = [];
  for (const country of countries) {
    if (country.names.some((name) => wordMatch(text, name, false)) || (country.abbreviations ?? []).some((abbr) => wordMatch(text, abbr, true))) {
      found.push(country.code);
    }
  }
  return found;
}

/**
 * In free text a country is only "named" when it appears in an eligibility/location phrase
 * ("based in Germany", "candidates from the UK", "US-only"); a stray "our Germany office" or the
 * pronoun "us" must not count. Title and structured location are trusted wholesale.
 */
const eligibilityCue = String.raw`(?:based|located|living|residing|resident|residents|citizens|candidates|applicants|hiring|hire|hires|working|work|eligible|available|open to|right to work|authori[sz]ed to work)`;
const preposition = String.raw`(?:in|from|within|across|to)`;

function eligibilityClauses(description: string): string[] {
  const clauses: string[] = [];
  const cueRegex = new RegExp(`${eligibilityCue}\\s+${preposition}\\s+(?:the\\s+)?([^.;\\n]{1,80})`, "gi");
  for (const match of description.matchAll(cueRegex)) clauses.push(match[1]);
  for (const match of description.matchAll(/([^\s,;()]{1,25})[ -]only\b/gi)) clauses.push(match[1]);
  return clauses;
}

export interface LocationSignals {
  countries: string[];
  regions: string[];
  timezones: string[];
}

export function extractLocationSignals(input: { title: string; location: string | null; descriptionText: string }): LocationSignals {
  const trusted = [input.title, input.location].filter(Boolean).join("\n");
  const clauses = eligibilityClauses(input.descriptionText).join("\n");
  const scoped = `${trusted}\n${clauses}`;

  const codes = new Set(countriesIn(scoped));
  const foundRegions = new Set<string>();
  const anywhere = `${trusted}\n${input.descriptionText}`;
  for (const { region, patterns, scope } of regions) {
    const haystack = scope === "anywhere" ? anywhere : scoped;
    if (patterns.some((pattern) => pattern.test(haystack))) foundRegions.add(region);
  }

  const timezoneText = `${trusted}\n${input.descriptionText.slice(0, 6000)}`;
  const timezones = new Set<string>();
  for (const pattern of timezonePatterns) {
    for (const match of timezoneText.matchAll(pattern)) timezones.add(match[0].replace(/\s+/g, "").replace("−", "-"));
  }

  return {
    countries: [...codes].sort(),
    regions: [...foundRegions].sort(),
    timezones: [...timezones].sort()
  };
}

const relocationOffered =
  /\brelocation (?:assistance|package|support|bonus|allowance|budget|help|reimbursement|stipend)\b|\b(?:offers?|provides?|providing|offering|support(?:s|ing)?|covers?|covering|includes?|including|with) (?:a )?relocation\b|\brelocation (?:is )?(?:offered|provided|available|supported|covered)\b|\b(?:assistance|help|support) with relocation\b|\brelocation costs? (?:are )?(?:covered|paid|reimbursed)\b/i;
const relocationUnavailable =
  /\bno relocation\b|\bwithout relocation\b|\brelocation (?:is )?not (?:available|offered|provided|supported|possible)\b|\b(?:do(?:es)? not|don't|doesn't|cannot|can't|unable to|will not|won't) (?:offer|provide|support|cover) relocation\b/i;

/** Relocation support is independent of visa sponsorship; unavailable wins over offered when both appear. */
export function detectRelocation(text: string): Relocation {
  if (relocationUnavailable.test(text)) return "unavailable";
  if (relocationOffered.test(text)) return "offered";
  return "unknown";
}

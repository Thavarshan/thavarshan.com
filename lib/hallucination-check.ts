const boilerplatePhrases = new Set([
  "dear hiring team",
  "dear hiring manager",
  "to whom it may concern",
  "best regards",
  "kind regards",
  "sincerely yours",
  "yours sincerely",
  "yours faithfully",
  "thank you"
]);

// Multi-word Title Case sequences are a reasonable proxy for proper nouns (company names,
// institutions, certifications) without the noise of every capitalized sentence-starter word.
const titleCasePhrase = /\b(?:[A-Z][\w.&']*\s+){1,3}[A-Z][\w.&']*\b/g;

/**
 * Heuristically flags proper-noun-like phrases in AI-generated cover letter text that don't
 * appear anywhere in the supplied allowlist (built from the candidate's verified profile plus
 * the target job's own posting data, which is legitimately expected to be mentioned). This is
 * advisory only — flagged terms are surfaced for human review, never silently removed, since a
 * cover letter is expected to contain some genuinely new phrasing and a heuristic can't safely
 * "correct" prose the way a structured field can be validated.
 */
export function scanForUnlistedTerms(text: string, allowlistTerms: string[]): string[] {
  const allowlistBlob = allowlistTerms
    .filter((term) => term.trim().length > 0)
    .map((term) => term.toLowerCase())
    .join(" | ");

  const flagged = new Set<string>();
  for (const rawMatch of text.match(titleCasePhrase) ?? []) {
    const phrase = rawMatch.trim();
    const normalized = phrase.toLowerCase();
    if (boilerplatePhrases.has(normalized)) continue;
    if (allowlistBlob.includes(normalized)) continue;
    flagged.add(phrase);
  }

  return [...flagged];
}

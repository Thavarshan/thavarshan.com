import { OPPORTUNITY_ID_PATTERN, parseReviewMap, type ReviewEntry, type ReviewMap } from "../../src/features/jobs/review";

/** Deliberately read-only: this Worker must never modify the existing review UI's KV records. */
export interface ReadOnlyKV {
  get(key: string): Promise<string | null>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

const PREFIX = "review:";
const MAX_KEYS = 400;

export interface LegacyBackup {
  schemaVersion: 1;
  checksum: string;
  source: { aggregate: string | null; entries: { key: string; value: string }[] };
  reviews: ReviewMap;
}

function validateReviews(reviews: ReviewMap) {
  if (Object.keys(reviews).length > MAX_KEYS || Object.keys(reviews).some((id) => !OPPORTUNITY_ID_PATTERN.test(id)))
    throw new Error("Invalid legacy review keys");
  for (const entry of Object.values(reviews)) if (!Number.isFinite(Date.parse(entry.updatedAt))) throw new Error("Invalid legacy review timestamp");
}

async function checksumOf(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Export *unaltered* KV sources before importing. Aggregate and per-ID values remain available
 * for manual recovery, including tombstones and closed opportunities not in the public snapshot.
 */
export async function exportLegacyKV(kv: ReadOnlyKV): Promise<LegacyBackup> {
  const aggregate = await kv.get("reviews");
  const reviews = aggregate === null ? {} : parseReviewMap(JSON.parse(aggregate));
  if (!reviews) throw new Error("Legacy aggregate is invalid");
  validateReviews(reviews);

  const keys = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const page = await kv.list({ prefix: PREFIX, cursor, limit: MAX_KEYS });
    if (!Array.isArray(page.keys) || typeof page.list_complete !== "boolean") throw new Error("Incomplete KV listing");
    for (const entry of page.keys) {
      if (!entry.name.startsWith(PREFIX) || !OPPORTUNITY_ID_PATTERN.test(entry.name.slice(PREFIX.length)) || keys.has(entry.name))
        throw new Error("Invalid KV review key");
      keys.add(entry.name);
      if (keys.size > MAX_KEYS) throw new Error("Too many KV reviews for one migration");
    }
    if (page.list_complete) break;
    if (!page.cursor || page.cursor === cursor) throw new Error("Incomplete KV listing");
    cursor = page.cursor;
  }

  const entries: { key: string; value: string }[] = [];
  for (const key of [...keys].sort()) {
    const value = await kv.get(key);
    if (value === null) throw new Error("KV review disappeared during export");
    const id = key.slice(PREFIX.length);
    const record = parseReviewMap({ [id]: JSON.parse(value) });
    if (!record) throw new Error("Invalid KV review record");
    validateReviews(record);
    entries.push({ key, value });
    const review: ReviewEntry = record[id];
    if (review.status === "new" && review.note === "") delete reviews[id];
    else reviews[id] = review;
  }

  const source = { aggregate, entries };
  return { schemaVersion: 1, checksum: await checksumOf(JSON.stringify(source)), source, reviews };
}

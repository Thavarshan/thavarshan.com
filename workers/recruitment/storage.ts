import { opportunitySnapshotSchema, type OpportunitySnapshot } from "../../src/features/jobs/opportunities";
import { OPPORTUNITY_ID_PATTERN, parseReviewMap, type ReviewEntry } from "../../src/features/jobs/review";

/** The small subset of Cloudflare's D1 binding used here, also exercised against real SQLite in tests. */
export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<SqlResult>;
}
export interface SqlResult {
  success: boolean;
  meta?: { changes?: number };
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<SqlResult[]>;
}

export class VersionConflict extends Error {}
export class InvalidStoredData extends Error {}

export const IMPORT_PAGE_SIZE = 20;
export const EXPORT_PAGE_SIZE = 40;

export async function databaseReady(db: Database): Promise<boolean> {
  const row = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'completed_imports'").first<{ name: string }>();
  return row?.name === "completed_imports";
}

/** Only versioned, validated public data crosses from a snapshot into private D1. */
export function validateSnapshot(value: unknown): OpportunitySnapshot {
  const snapshot = opportunitySnapshotSchema.parse(value);
  if (snapshot.opportunities.some((item) => !OPPORTUNITY_ID_PATTERN.test(item.id))) throw new Error("Invalid opportunity identifier");
  const ids = new Set(snapshot.opportunities.map((item) => item.id));
  if (ids.size !== snapshot.opportunities.length) throw new Error("Duplicate opportunity identifier");
  return snapshot;
}

export async function importSnapshotPage(db: Database, snapshot: OpportunitySnapshot, offset: number, expectedGeneratedAt: string, now: string) {
  if (snapshot.generatedAt !== expectedGeneratedAt) throw new VersionConflict("Snapshot changed; restart the import with its new timestamp");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > snapshot.opportunities.length) throw new RangeError("Invalid import offset");
  const page = snapshot.opportunities.slice(offset, offset + IMPORT_PAGE_SIZE);
  if (page.length) {
    const statements = page.map((item) => {
      const payload = JSON.stringify(item);
      if (new TextEncoder().encode(payload).length > 1_000_000) throw new RangeError("Opportunity exceeds the 1 MB storage safety limit");
      return db
        .prepare(
          `INSERT INTO opportunities (id, payload_json, snapshot_version, snapshot_generated_at, updated_at)
          VALUES (?, ?, 2, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            snapshot_version = excluded.snapshot_version,
            snapshot_generated_at = excluded.snapshot_generated_at,
            updated_at = excluded.updated_at
          WHERE excluded.snapshot_generated_at > opportunities.snapshot_generated_at`
        )
        .bind(item.id, payload, snapshot.generatedAt, now);
    });
    const audit = db
      .prepare("INSERT INTO audit_events (action, entity_type, entity_id, occurred_at, detail_json) VALUES ('snapshot.page', 'opportunities', ?, ?, ?)")
      .bind(snapshot.generatedAt, now, JSON.stringify({ offset, count: page.length }));
    const results = await db.batch([...statements, audit]); // D1 executes a batch as one transaction.
    if (results.length !== statements.length + 1 || results.some((result) => !result.success)) throw new Error("Snapshot transaction failed");
  }
  const nextOffset = offset + page.length;
  return {
    schemaVersion: 2,
    generatedAt: snapshot.generatedAt,
    processed: page.length,
    nextOffset,
    total: snapshot.opportunities.length,
    complete: nextOffset === snapshot.opportunities.length
  };
}

export async function listOpportunities(db: Database, after: string, limit: number) {
  const result = await db
    .prepare("SELECT id, payload_json FROM opportunities WHERE id > ? ORDER BY id LIMIT ?")
    .bind(after, Math.min(EXPORT_PAGE_SIZE, limit))
    .all<{ id: string; payload_json: string }>();
  return result.results.map((row) => {
    const parsed = opportunitySnapshotSchema.shape.opportunities.element.parse(JSON.parse(row.payload_json));
    if (parsed.id !== row.id) throw new InvalidStoredData("Opportunity key mismatch");
    return parsed;
  });
}

export interface ReviewRecord extends ReviewEntry {
  opportunityId: string;
  revision: number;
}

export async function listReviews(db: Database, after: string, limit: number): Promise<ReviewRecord[]> {
  const result = await db
    .prepare("SELECT opportunity_id, status, note, updated_at, revision FROM reviews WHERE opportunity_id > ? ORDER BY opportunity_id LIMIT ?")
    .bind(after, Math.min(EXPORT_PAGE_SIZE, limit))
    .all<{ opportunity_id: string; status: string; note: string; updated_at: string; revision: number }>();
  return result.results.map((row) => {
    if (!OPPORTUNITY_ID_PATTERN.test(row.opportunity_id) || !Number.isSafeInteger(row.revision) || row.revision <= 0)
      throw new InvalidStoredData("Invalid saved review identifier or version");
    const parsed = parseReviewMap({ [row.opportunity_id]: { status: row.status, note: row.note, updatedAt: row.updated_at } });
    if (!parsed || !Number.isFinite(Date.parse(row.updated_at))) throw new InvalidStoredData("Invalid saved review record");
    return { opportunityId: row.opportunity_id, ...parsed[row.opportunity_id], revision: row.revision };
  });
}

/** A compare-and-swap write. Concurrent saves at the same revision cannot silently overwrite one another. */
export async function saveReview(
  db: Database,
  input: { opportunityId: string; status: ReviewEntry["status"]; note: string; expectedRevision: number },
  now: string
) {
  const { opportunityId, status, note, expectedRevision } = input;
  if (!OPPORTUNITY_ID_PATTERN.test(opportunityId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 2_000_000_000)
    throw new RangeError("Invalid review version");
  const write =
    expectedRevision === 0
      ? db
          .prepare("INSERT OR IGNORE INTO reviews (opportunity_id, status, note, updated_at, revision) VALUES (?, ?, ?, ?, 1)")
          .bind(opportunityId, status, note, now)
      : db
          .prepare("UPDATE reviews SET status = ?, note = ?, updated_at = ?, revision = revision + 1 WHERE opportunity_id = ? AND revision = ?")
          .bind(status, note, now, opportunityId, expectedRevision);
  const audit = db
    .prepare(
      `INSERT INTO audit_events (action, entity_type, entity_id, occurred_at)
      SELECT 'review.saved', 'review', ?, ? WHERE changes() = 1`
    )
    .bind(opportunityId, now);
  const results = await db.batch([write, audit]);
  if (results.length !== 2 || results.some((result) => !result.success)) throw new Error("Review transaction failed");
  if (results[0].meta?.changes !== 1) throw new VersionConflict("Review was changed elsewhere; reload before saving");
  return { opportunityId, status, note, updatedAt: now, revision: expectedRevision + 1 };
}

export interface LegacyImport {
  source: "job-review-kv-v1";
  checksum: string;
  importedAt: string;
  recordCount: number;
}

export async function getLegacyImport(db: Database): Promise<LegacyImport | null> {
  const row = await db
    .prepare("SELECT source, checksum, imported_at, record_count FROM completed_imports WHERE source = 'job-review-kv-v1'")
    .first<{ source: "job-review-kv-v1"; checksum: string; imported_at: string; record_count: number }>();
  return row ? { source: row.source, checksum: row.checksum, importedAt: row.imported_at, recordCount: row.record_count } : null;
}

/** One batch: either the marker and *all* records commit, or none do. Existing edits win. */
export async function importLegacyReviews(db: Database, checksum: string, reviews: Record<string, ReviewEntry>, now: string) {
  const existing = await getLegacyImport(db);
  if (existing) {
    if (existing.checksum !== checksum) throw new VersionConflict("A different KV backup was already imported");
    return { imported: false, recordCount: existing.recordCount };
  }
  const entries = Object.entries(reviews).sort(([a], [b]) => a.localeCompare(b));
  const marker = db
    .prepare("INSERT INTO completed_imports (source, checksum, imported_at, record_count) VALUES ('job-review-kv-v1', ?, ?, ?)")
    .bind(checksum, now, entries.length);
  const statements = [
    marker,
    ...entries.map(([id, review]) =>
      db
        .prepare("INSERT OR IGNORE INTO reviews (opportunity_id, status, note, updated_at, revision) VALUES (?, ?, ?, ?, 1)")
        .bind(id, review.status, review.note, review.updatedAt)
    )
  ];
  const audit = db
    .prepare("INSERT INTO audit_events (action, entity_type, entity_id, occurred_at) VALUES ('legacy.import', 'migration', 'job-review-kv-v1', ?)")
    .bind(now);
  const results = await db.batch([...statements, audit]);
  if (results.length !== statements.length + 1 || results.some((result) => !result.success)) throw new Error("Legacy import transaction failed");
  return { imported: true, recordCount: entries.length };
}

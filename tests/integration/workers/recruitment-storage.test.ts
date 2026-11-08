// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { handleRequest, type Env } from "@workers/recruitment/index";
import { exportLegacyKV, type ReadOnlyKV } from "@workers/recruitment/legacy";
import {
  importLegacyReviews,
  importSnapshotPage,
  listOpportunities,
  saveReview,
  validateSnapshot,
  type Database,
  type SqlResult,
  type Statement
} from "@workers/recruitment/storage";
import { makeOpportunity } from "../../helpers/opportunity";
import type { OpportunitySnapshot } from "@/features/jobs/opportunities";

const migration = readFileSync(resolve(process.cwd(), "workers/recruitment/migrations/0001_recruitment.sql"), "utf8");
const A = "aaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbb";
const now = new Date("2026-11-08T07:00:00.000Z");

class LocalStatement implements Statement {
  private args: (string | number | null)[] = [];
  constructor(
    readonly owner: LocalD1,
    readonly sql: string
  ) {}
  bind(...args: (string | number | null)[]) {
    this.args = args;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.owner.sqlite.prepare(this.sql).get(...this.args) as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.owner.sqlite.prepare(this.sql).all(...this.args) as T[] };
  }
  async run(): Promise<SqlResult> {
    const result = this.owner.sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

/** Executes the *real* D1 migration in SQLite and emulates Cloudflare's atomic batch semantics. */
class LocalD1 implements Database {
  readonly sqlite = new DatabaseSync(":memory:");
  failBatchAt: number | null = null;
  private pending: Promise<void> = Promise.resolve();
  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    this.sqlite.exec(migration);
  }
  prepare(sql: string) {
    return new LocalStatement(this, sql);
  }
  async batch(statements: Statement[]) {
    // Cloudflare queues D1 transactions; model that rather than overlapping BEGINs on one connection.
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const previous = this.pending;
    this.pending = next;
    await previous;
    const results: SqlResult[] = [];
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      for (const [index, statement] of statements.entries()) {
        if (index === this.failBatchAt) throw new Error("Synthetic quota exhaustion");
        results.push(await statement.run());
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    } finally {
      release();
    }
  }
}

function kv(initial: Record<string, string> = {}): ReadOnlyKV {
  const values = new Map(Object.entries(initial));
  return {
    get: async (key) => values.get(key) ?? null,
    list: async ({ prefix }) => ({ keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true })
  };
}

const snapshot = (count = 2): OpportunitySnapshot => ({
  schemaVersion: 2,
  generatedAt: "2026-11-08T06:00:00.000Z",
  collectorVersion: null,
  candidate: { location: "Sri Lanka", preferredStack: [], experienceYears: 11, workModes: ["remote"] },
  sources: [],
  opportunities: Array.from({ length: count }, (_, i) =>
    makeOpportunity({
      id: i.toString(16).padStart(20, "0"),
      canonicalUrl: `https://example.org/job/${i}`,
      title: `Role ${i}`,
      score: 70
    })
  )
});

const environment = (db: Database, records: ReadOnlyKV = kv(), extra: Partial<Env> = {}): Env => ({
  RECRUITMENT_DB: db,
  JOBS_KV: records,
  JOBS_DATA_URL: "https://data.example/jobs.json",
  DEV_AUTH_BYPASS: "1",
  ...extra
});
const request = (path: string, body?: unknown, origin = "http://localhost") =>
  new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json", Origin: origin },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
const call = (r: Request, env: Env, data: OpportunitySnapshot = snapshot(), logs: string[] = []) =>
  handleRequest(r, env, { now, log: (line) => logs.push(line), fetcher: (async () => new Response(JSON.stringify(data))) as typeof fetch });

describe("private D1 recruitment boundary", () => {
  it("applies a real, repeatable migration with all six recruitment tables and reviews", () => {
    const db = new LocalD1();
    const tables = db.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name);
    for (const table of ["opportunities", "interactions", "pipeline_events", "sync_cursors", "tasks", "audit_events", "reviews", "completed_imports"])
      expect(tables).toContain(table);
    expect(() => db.sqlite.exec(migration)).not.toThrow();
  });

  it("does not serve anonymous, wrong-owner, remote bypass, or unconfigured requests", async () => {
    const db = new LocalD1();
    expect((await call(request("/healthz"), { ...environment(db), DEV_AUTH_BYPASS: undefined })).status).toBe(403);
    const wrongOwner = environment(db, kv(), {
      DEV_AUTH_BYPASS: undefined,
      ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      ACCESS_AUD: "aud",
      ALLOWED_EMAIL: "owner@example.org"
    });
    expect((await call(request("/healthz"), wrongOwner)).status).toBe(403);
    const remote = new Request("https://recruitment.example.com/healthz");
    expect((await call(remote, environment(db))).status).toBe(403);
    expect((await call(request("/healthz"), environment(db))).status).toBe(200);
  });

  it("imports the *public* schema v2 snapshot in bounded, idempotent pages", async () => {
    const db = new LocalD1();
    const data = snapshot(21);
    expect((await call(request("/v1/snapshot"), environment(db), data)).status).toBe(200);
    const first = await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 0 }), environment(db), data);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ processed: 20, nextOffset: 20, total: 21, complete: false });
    const second = await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 20 }), environment(db), data);
    expect(await second.json()).toMatchObject({ processed: 1, complete: true });
    expect((await listOpportunities(db, "", 40)).length).toBe(21);

    const revisionTime = db.sqlite.prepare("SELECT updated_at FROM opportunities WHERE id = ?").get(data.opportunities[0].id);
    await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 0 }), environment(db), data);
    expect(db.sqlite.prepare("SELECT updated_at FROM opportunities WHERE id = ?").get(data.opportunities[0].id)).toEqual(revisionTime);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM opportunities").get()).toEqual({ n: 21 });
    expect((await call(request("/v1/snapshot/import", { expectedGeneratedAt: "2026-01-01T00:00:00.000Z", offset: 0 }), environment(db), data)).status).toBe(
      409
    );
    expect(() => validateSnapshot({ ...data, schemaVersion: 3 })).toThrow();
  });

  it("rejects unsafe writes and never acknowledges a transaction when D1 exceeds quota", async () => {
    const db = new LocalD1();
    const data = snapshot();
    const env = environment(db);
    expect((await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 0 }, "https://evil.example"), env, data)).status).toBe(
      403
    );
    expect(
      (await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 0 }), environment(db, kv(), { READ_ONLY: "1" }), data)).status
    ).toBe(403);
    expect((await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: -1 }), env, data)).status).toBe(400);
    db.failBatchAt = 1;
    expect((await call(request("/v1/snapshot/import", { expectedGeneratedAt: data.generatedAt, offset: 0 }), env, data)).status).toBe(503);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM opportunities").get()).toEqual({ n: 0 });
  });

  it("uses optimistic revisions: concurrent edits cannot erase each other and audit writes are atomic", async () => {
    const db = new LocalD1();
    const env = environment(db);
    const create = request(`/v1/reviews/${A}`, { status: "reviewed", note: "Private note", expectedRevision: 0 });
    expect((await call(create, env)).status).toBe(200);
    const [a, b] = await Promise.all([
      call(request(`/v1/reviews/${A}`, { status: "shortlisted", note: "One", expectedRevision: 1 }), env),
      call(request(`/v1/reviews/${A}`, { status: "dismissed", note: "Two", expectedRevision: 1 }), env)
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(db.sqlite.prepare("SELECT revision FROM reviews WHERE opportunity_id = ?").get(A)).toEqual({ revision: 2 });
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action = 'review.saved'").get()).toEqual({ n: 2 });

    db.failBatchAt = 1; // Failure *after* the row update must roll back the first statement.
    expect((await call(request(`/v1/reviews/${A}`, { status: "reviewed", note: "Lost update", expectedRevision: 2 }), env)).status).toBe(503);
    expect(db.sqlite.prepare("SELECT revision, note FROM reviews WHERE opportunity_id = ?").get(A)).not.toMatchObject({ revision: 3, note: "Lost update" });
  });

  it("exports raw KV before importing once, honours tombstones and never overwrites D1 edits", async () => {
    const db = new LocalD1();
    const records = kv({
      reviews: JSON.stringify({
        [A]: { status: "shortlisted", note: "Legacy A", updatedAt: now.toISOString() },
        [B]: { status: "reviewed", note: "Legacy B", updatedAt: now.toISOString() }
      }),
      [`review:${A}`]: JSON.stringify({ status: "dismissed", note: "Latest A", updatedAt: now.toISOString() }),
      [`review:${B}`]: JSON.stringify({ status: "new", note: "", updatedAt: now.toISOString() })
    });
    const backup = await exportLegacyKV(records);
    expect(backup.reviews[A].note).toBe("Latest A");
    expect(backup.reviews[B]).toBeUndefined();
    expect(backup.source.aggregate).toContain("Legacy B"); // Raw backup preserves tombstones and old notes.
    const env = environment(db, records);
    const exportResponse = await call(request("/v1/legacy/export"), env);
    expect(exportResponse.headers.get("Content-Disposition")).toContain("attachment");
    expect((await exportResponse.json()).checksum).toBe(backup.checksum);

    // Simulate an independent D1 edit before import: the migration must never overwrite it.
    await saveReview(db, { opportunityId: A, status: "reviewed", note: "New D1 note", expectedRevision: 0 }, now.toISOString());
    const migrated = await call(request("/v1/legacy/import", { checksum: backup.checksum }), env);
    expect(migrated.status).toBe(200);
    expect(await migrated.json()).toMatchObject({ imported: true, recordCount: 1 });
    expect(db.sqlite.prepare("SELECT note FROM reviews WHERE opportunity_id = ?").get(A)).toEqual({ note: "New D1 note" });
    expect((await call(request("/v1/legacy/import", { checksum: backup.checksum }), env)).status).toBe(200);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM completed_imports").get()).toEqual({ n: 1 });
    expect((await call(request("/v1/legacy/import", { checksum: "0".repeat(64) }), env)).status).toBe(409);
  });

  it("preserves a source export and database state across backup and restore", async () => {
    const db = new LocalD1();
    await importSnapshotPage(db, snapshot(1), 0, snapshot(1).generatedAt, now.toISOString());
    await importLegacyReviews(
      db,
      "f".repeat(64),
      { [A]: { status: "reviewed", note: "Synthetic fixture only", updatedAt: now.toISOString() } },
      now.toISOString()
    );
    const binary = (db.sqlite as DatabaseSync & { serialize(): Uint8Array }).serialize();
    const restored = new DatabaseSync(":memory:");
    (restored as DatabaseSync & { deserialize(input: Uint8Array): void }).deserialize(binary);
    expect(restored.prepare("SELECT count(*) AS n FROM opportunities").get()).toEqual({ n: 1 });
    expect(restored.prepare("SELECT note FROM reviews WHERE opportunity_id = ?").get(A)).toEqual({ note: "Synthetic fixture only" });
    expect(restored.prepare("SELECT checksum FROM completed_imports").get()).toEqual({ checksum: "f".repeat(64) });
    restored.close();
  });

  it("fails closed on malformed or incomplete KV and never logs secrets or job query strings", async () => {
    const bad = kv({ [`review:${A}`]: "not json" });
    await expect(exportLegacyKV(bad)).rejects.toThrow();
    const partial: ReadOnlyKV = { get: async () => null, list: async () => ({ keys: [], list_complete: false }) };
    await expect(exportLegacyKV(partial)).rejects.toThrow(/Incomplete/);

    const db = new LocalD1();
    const logs: string[] = [];
    await call(request(`/v1/reviews/${A}`, { status: "reviewed", note: "SECRET PERSONAL NOTE", expectedRevision: 0 }), environment(db), snapshot(), logs);
    await call(request("/v1/reviews?after=secret-query"), environment(db), snapshot(), logs);
    await call(request("/unmatched/owner@example.org/private-key"), environment(db), snapshot(), logs);
    const combined = logs.join("\n");
    for (const secret of ["SECRET PERSONAL NOTE", "secret-query", A, "owner@example.org", "private-key"]) expect(combined).not.toContain(secret);
  });
});

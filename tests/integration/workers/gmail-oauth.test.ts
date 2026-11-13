// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { handleRequest, type Env } from "@workers/recruitment/index";
import { GMAIL_SCOPE } from "@workers/recruitment/gmail-oauth";
import type { Database, SqlResult, Statement } from "@workers/recruitment/storage";

const migration = ["0001_recruitment.sql", "0002_gmail_oauth.sql"]
  .map((name) => readFileSync(resolve(process.cwd(), "workers/recruitment/migrations", name), "utf8"))
  .join("\n");
const now = new Date("2026-11-08T08:00:00.000Z");
const key = btoa("0123456789abcdefghijklmnopqrstuv");

class LocalStatement implements Statement {
  private args: (string | number | null)[] = [];
  constructor(
    private readonly db: LocalDatabase,
    private readonly sql: string
  ) {}
  bind(...args: (string | number | null)[]) {
    this.args = args;
    return this;
  }
  async first<T>() {
    return (this.db.sqlite.prepare(this.sql).get(...this.args) as T | undefined) ?? null;
  }
  async all<T>() {
    return { results: this.db.sqlite.prepare(this.sql).all(...this.args) as T[] };
  }
  async run(): Promise<SqlResult> {
    const result = this.db.sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class LocalDatabase implements Database {
  readonly sqlite = new DatabaseSync(":memory:");
  failBatchAt: number | null = null;
  constructor() {
    this.sqlite.exec(migration);
  }
  prepare(sql: string) {
    return new LocalStatement(this, sql);
  }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    const results: SqlResult[] = [];
    try {
      for (const [index, statement] of statements.entries()) {
        if (index === this.failBatchAt) throw new Error("Synthetic D1 quota exhaustion");
        results.push(await statement.run());
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function environment(db: Database, override: Partial<Env> = {}): Env {
  return {
    RECRUITMENT_DB: db,
    JOBS_KV: { get: async () => null, list: async () => ({ keys: [], list_complete: true }) },
    JOBS_DATA_URL: "https://data.example/jobs.json",
    ALLOWED_EMAIL: "owner@example.com",
    DEV_AUTH_BYPASS: "1",
    GOOGLE_OAUTH_CLIENT_ID: "synthetic-client.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "synthetic-client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost/v1/gmail/callback",
    GMAIL_TOKEN_KEY_B64: key,
    ...override
  };
}

function startRequest(origin = "http://localhost") {
  return new Request("http://localhost/v1/gmail/authorize", { method: "POST", headers: { Origin: origin } });
}

function google(fake: { email?: string; scope?: string; tokenStatus?: number; profileStatus?: number } = {}) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    if (String(url) === "https://oauth2.googleapis.com/token")
      return new Response(
        JSON.stringify({
          access_token: "SYNTHETIC-ACCESS-SECRET",
          refresh_token: "SYNTHETIC-REFRESH-SECRET",
          scope: fake.scope ?? GMAIL_SCOPE,
          token_type: "Bearer"
        }),
        { status: fake.tokenStatus ?? 200 }
      );
    if (String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/profile")
      return new Response(JSON.stringify({ emailAddress: fake.email ?? "owner@example.com", historyId: "18446744073709551615" }), {
        status: fake.profileStatus ?? 200
      });
    throw new Error("Unexpected outbound request");
  }) as typeof fetch;
  return { requests, fetcher };
}

function call(request: Request, env: Env, fetcher: typeof fetch = google().fetcher, logs: string[] = []) {
  return handleRequest(request, env, { now, fetcher, log: (line) => logs.push(line) });
}

async function start(db: LocalDatabase, env = environment(db)) {
  const result = await call(startRequest(), env);
  expect(result.status).toBe(200);
  const body = (await result.json()) as { authorizationUrl: string; expiresInSeconds: number };
  return new URL(body.authorizationUrl);
}

function callback(url: URL, extras: Record<string, string> = { code: "synthetic-code" }) {
  const target = new URL("http://localhost/v1/gmail/callback");
  target.searchParams.set("state", url.searchParams.get("state") ?? "");
  for (const [k, v] of Object.entries(extras)) target.searchParams.set(k, v);
  return new Request(target);
}

describe("owner-only read-only Gmail OAuth foundation", () => {
  it("applies the OAuth migration, including an encrypted token column and one-time state table", () => {
    const db = new LocalDatabase();
    const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'gmail_oauth_%'").all();
    expect(tables).toHaveLength(2);
    expect(() => db.sqlite.exec(migration)).not.toThrow();
  });

  it("refuses anonymous, wrong-owner, cross-origin and read-only preview requests", async () => {
    const db = new LocalDatabase();
    const env = environment(db);
    expect((await call(startRequest(), { ...env, DEV_AUTH_BYPASS: undefined })).status).toBe(403);
    expect((await call(startRequest(), { ...env, DEV_AUTH_BYPASS: undefined, ACCESS_AUD: "wrong" })).status).toBe(403);
    expect((await call(startRequest("https://evil.example"), env)).status).toBe(403);
    expect((await call(startRequest(), { ...env, READ_ONLY: "1" })).status).toBe(403);
    const flow = await start(db);
    expect((await call(callback(flow), { ...env, READ_ONLY: "1" })).status).toBe(403);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_credentials").get()).toEqual({ n: 0 });
  });

  it("serves a protected browser connect page with same-origin form submission only", async () => {
    const db = new LocalDatabase();
    const response = await call(new Request("http://localhost/v1/gmail/connect"), environment(db));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self' https://accounts.google.com");
    expect(response.headers.get("content-security-policy")).not.toContain("connect-src");
    const page = await response.text();
    expect(page).toContain('<form method="post" action="/v1/gmail/authorize">');
    expect(page).toContain('name="flow" value="connect"');
    expect(page).not.toContain("<script");
    expect((await call(new Request("http://localhost/v1/gmail/connect"), environment(db, { DEV_AUTH_BYPASS: undefined }))).status).toBe(403);
  });

  it("redirects the same-origin browser form directly to the read-only Google consent screen", async () => {
    const db = new LocalDatabase();
    const response = await call(
      new Request("http://localhost/v1/gmail/authorize", {
        method: "POST",
        headers: { Origin: "http://localhost", "Content-Type": "application/x-www-form-urlencoded" },
        body: "flow=connect"
      }),
      environment(db)
    );
    expect(response.status).toBe(303);
    expect(await response.text()).toBe("");
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_pending").get()).toEqual({ n: 1 });
  });

  it("accepts a browser same-origin navigation when a proxy rewrites Origin", async () => {
    const db = new LocalDatabase();
    const response = await call(
      new Request("http://localhost/v1/gmail/authorize", {
        method: "POST",
        headers: {
          Origin: "https://access.example",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document"
        },
        body: "flow=connect"
      }),
      environment(db)
    );
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("Location") ?? "").origin).toBe("https://accounts.google.com");
  });

  it("rejects cross-site browser form submissions even when they target OAuth authorize", async () => {
    const db = new LocalDatabase();
    const response = await call(
      new Request("http://localhost/v1/gmail/authorize", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document"
        },
        body: "flow=connect"
      }),
      environment(db)
    );
    expect(response.status).toBe(403);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_pending").get()).toEqual({ n: 0 });
  });

  it("uses an unguessable single-use state, S256 PKCE and never requests send/modify scopes", async () => {
    const db = new LocalDatabase();
    const flow = await start(db);
    expect(flow.origin).toBe("https://accounts.google.com");
    expect(flow.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(flow.searchParams.get("access_type")).toBe("offline");
    expect(flow.searchParams.get("response_type")).toBe("code");
    expect(flow.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const pending = db.sqlite.prepare("SELECT state_hash, verifier_ciphertext FROM gmail_oauth_pending").get() as Record<string, string>;
    expect(pending.state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(pending.verifier_ciphertext).toMatch(/^v1:/);
    expect(pending.state_hash).not.toContain(flow.searchParams.get("state"));

    const api = google();
    const logs: string[] = [];
    const result = await call(callback(flow), environment(db), api.fetcher, logs);
    expect(result.status).toBe(303);
    expect(result.headers.get("Location")).toBe("http://localhost/v1/gmail/status");
    expect(api.requests.map((r) => r.url)).toEqual(["https://oauth2.googleapis.com/token", "https://gmail.googleapis.com/gmail/v1/users/me/profile"]);
    const form = new URLSearchParams(api.requests[0].init?.body as string);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(form.get("code_verifier")!)));
    const challenge = btoa(String.fromCharCode(...hash))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(challenge).toBe(flow.searchParams.get("code_challenge"));
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(api.requests[1].init?.headers).toMatchObject({ Authorization: "Bearer SYNTHETIC-ACCESS-SECRET" });
    expect(db.sqlite.prepare("SELECT status FROM gmail_oauth_credentials").get()).toEqual({ status: "connected" });
    expect(db.sqlite.prepare("SELECT cursor_json FROM sync_cursors WHERE source = 'gmail'").get()).toEqual({
      cursor_json: JSON.stringify({ phase: "not-started", initialHistoryId: "18446744073709551615" })
    });
    const stored = JSON.stringify(db.sqlite.prepare("SELECT * FROM gmail_oauth_credentials").all());
    expect(stored).not.toContain("SYNTHETIC-REFRESH-SECRET");
    expect(stored).not.toContain("SYNTHETIC-ACCESS-SECRET");
    const report = logs.join("\n");
    for (const secret of ["synthetic-code", "SYNTHETIC-REFRESH-SECRET", "SYNTHETIC-ACCESS-SECRET", "owner@example.com", flow.searchParams.get("state")!])
      expect(report).not.toContain(secret);
    expect((await call(new Request("http://localhost/v1/gmail/status"), environment(db))).status).toBe(200);
    expect((await call(callback(flow), environment(db), api.fetcher)).status).toBe(409);
    expect(api.requests).toHaveLength(2);
  });

  it("consumes denied/expired state without calling Google or storing credentials", async () => {
    const db = new LocalDatabase();
    const flow = await start(db);
    const api = google();
    expect((await call(callback(flow, { error: "access_denied" }), environment(db), api.fetcher)).status).toBe(403);
    expect((await call(callback(flow), environment(db), api.fetcher)).status).toBe(409);
    expect(api.requests).toHaveLength(0);
    const fresh = await start(db);
    const expired = await handleRequest(callback(fresh), environment(db), { now: new Date(now.getTime() + 11 * 60_000), fetcher: api.fetcher, log: () => {} });
    expect(expired.status).toBe(409);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_credentials").get()).toEqual({ n: 0 });
  });

  it("refuses the wrong mailbox or scope without leaving a refresh token", async () => {
    for (const invalid of [{ email: "someone-else@example.com" }, { scope: "https://www.googleapis.com/auth/gmail.modify" }]) {
      const db = new LocalDatabase();
      const flow = await start(db);
      const api = google(invalid);
      expect((await call(callback(flow), environment(db), api.fetcher)).status).toBe(403);
      expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_credentials").get()).toEqual({ n: 0 });
    }
  });

  it("refuses missing configuration, a mismatched redirect, and failed Google token requests", async () => {
    const db = new LocalDatabase();
    expect((await call(startRequest(), environment(db, { GMAIL_TOKEN_KEY_B64: undefined }))).status).toBe(503);
    expect((await call(startRequest(), environment(db, { GOOGLE_OAUTH_REDIRECT_URI: "https://evil.example/v1/gmail/callback" }))).status).toBe(503);
    const flow = await start(db);
    const api = google({ tokenStatus: 429 });
    expect((await call(callback(flow), environment(db), api.fetcher)).status).toBe(503);
    expect((await call(callback(flow), environment(db), api.fetcher)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_credentials").get()).toEqual({ n: 0 });
  });

  it("keeps authentication and sync cursor atomic when D1 rejects a write", async () => {
    const db = new LocalDatabase();
    const flow = await start(db);
    db.failBatchAt = 1;
    expect((await call(callback(flow), environment(db), google().fetcher)).status).toBe(503);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM gmail_oauth_credentials").get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM sync_cursors WHERE source = 'gmail'").get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action = 'gmail.connected'").get()).toEqual({ n: 0 });
  });
});

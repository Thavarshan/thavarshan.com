// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest, type Env, type KVLike } from "@workers/site-metrics/index";
import { MAX_BODY_BYTES, RETENTION_SECONDS, limiter } from "@workers/site-metrics/config";
import { RateLimiter } from "@/shared/edge/platform";

const ORIGIN = "https://thavarshan.com";
const now = new Date("2026-10-03T12:34:56.000Z");
const event = { event: "repo_click", path: "/projects/fetch-php", source: "linkedin", medium: "social", campaign: "release-x", referrer: "social", props: { project: "fetch-php" } };

function kv(overrides: Partial<KVLike> = {}) {
  const store = new Map<string, string>();
  const ttls: number[] = [];
  const api: KVLike & { store: Map<string, string>; ttls: number[] } = {
    store, ttls,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value, options) => { store.set(key, value); if (options?.expirationTtl) ttls.push(options.expirationTtl); },
    ...overrides
  };
  return api;
}
const env = (store: KVLike, extra: Partial<Env> = {}): Env => ({ METRICS_KV: store, ...extra });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://site-metrics.example/collect", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "text/plain", "cf-connecting-ip": `203.0.113.${Math.floor(Math.random() * 250)}`, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const run = (request: Request, environment: Env, logs: string[] = []) => handleRequest(request, environment, { now, log: (line) => logs.push(line) });

beforeEach(() => { limiter.current = new RateLimiter(120, 60_000); });

describe("collecting events", () => {
  it("increments one aggregate counter per distinct event shape per UTC day", async () => {
    const store = kv();
    for (let i = 0; i < 3; i++) expect((await run(post(event), env(store))).status).toBe(204);
    await run(post({ ...event, campaign: "other-campaign" }), env(store));
    await run(post({ ...event, event: "cv_download", props: {} }), env(store));

    const entries = Object.fromEntries(store.store);
    expect(entries["m|2026-10-03|repo_click|/projects/fetch-php|linkedin|social|release-x|social|project=fetch-php"]).toBe("3");
    expect(entries["m|2026-10-03|repo_click|/projects/fetch-php|linkedin|social|other-campaign|social|project=fetch-php"]).toBe("1");
    expect(entries["m|2026-10-03|cv_download|/projects/fetch-php|linkedin|social|release-x|social|-"]).toBe("1");
    expect(store.store.size).toBe(3);
  });

  it("expires data after the retention period, so storage is bounded", async () => {
    const store = kv();
    await run(post(event), env(store));
    expect(store.ttls).toEqual([RETENTION_SECONDS]);
  });

  it("returns CORS for the allowed origin only", async () => {
    const response = await run(post(event), env(kv()));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const preflight = await run(new Request("https://m.example/collect", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env(kv()));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    const evil = await run(new Request("https://m.example/collect", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env(kv()));
    expect(evil.status).toBe(403);
    expect(evil.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("rejecting bad input", () => {
  it("403s other origins and a missing Origin, writing nothing", async () => {
    const store = kv();
    expect((await run(post(event, { Origin: "https://evil.example" }), env(store))).status).toBe(403);
    expect((await run(post(event, { Origin: "" }), env(store))).status).toBe(403);
    expect((await run(post(event, { Origin: "https://thavarshan.com.evil.example" }), env(store))).status).toBe(403);
    expect(store.store.size).toBe(0);
  });

  it("400s malformed JSON and anything the shared validator rejects", async () => {
    const store = kv();
    for (const body of ["{not json", "[]", JSON.stringify({ ...event, event: "purchase" }), JSON.stringify({ ...event, props: { project: "a@b.com" } }), JSON.stringify({ ...event, path: "/cv?e=a@b.com" }), JSON.stringify({ ...event, visitorId: "abc" })]) {
      expect((await run(post(body), env(store))).status, body).toBe(400);
    }
    expect(store.store.size).toBe(0);
  });

  it("413s oversized bodies, declared or streamed", async () => {
    const store = kv();
    expect((await run(post({ ...event, padding: "x".repeat(MAX_BODY_BYTES + 1) }), env(store))).status).toBe(413);
    const streamed = new Request("https://m.example/collect", { method: "POST", headers: { Origin: ORIGIN }, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("x".repeat(MAX_BODY_BYTES + 50))); c.close(); } }), duplex: "half" } as RequestInit);
    expect((await run(streamed, env(store))).status).toBe(413);
    expect(store.store.size).toBe(0);
  });

  it("405s wrong methods, 404s unknown routes", async () => {
    expect((await run(new Request("https://m.example/collect", { method: "GET", headers: { Origin: ORIGIN } }), env(kv()))).status).toBe(405);
    expect((await run(new Request("https://m.example/admin"), env(kv()))).status).toBe(404);
    expect((await run(new Request("https://m.example/"), env(kv()))).status).toBe(404);
  });

  it("rate limits a single client and leaves others alone", async () => {
    limiter.current = new RateLimiter(2, 60_000);
    const store = kv();
    const ip = { "cf-connecting-ip": "198.51.100.7" };
    expect([ (await run(post(event, ip), env(store))).status, (await run(post(event, ip), env(store))).status, (await run(post(event, ip), env(store))).status ]).toEqual([204, 204, 429]);
    expect((await run(post(event, { "cf-connecting-ip": "198.51.100.8" }), env(store))).status).toBe(204);
  });
});

describe("free-plan failure behaviour", () => {
  it("drops the event and answers 503 when KV is unavailable or over quota, without throwing", async () => {
    const down = kv({ get: async () => { throw new Error("kv down"); } });
    expect((await run(post(event), env(down))).status).toBe(503);
    const overQuota = kv({ put: async () => { throw new Error("KV put() limit exceeded for the day"); } });
    expect((await run(post(event), env(overQuota))).status).toBe(503);
  });

  it("recovers from a corrupted counter value", async () => {
    const store = kv();
    store.store.set("m|2026-10-03|repo_click|/projects/fetch-php|linkedin|social|release-x|social|project=fetch-php", "garbage");
    expect((await run(post(event), env(store))).status).toBe(204);
    expect([...store.store.values()]).toEqual(["1"]);
  });
});

describe("privacy", () => {
  it("stores nothing identifying: same key and value regardless of who sent it", async () => {
    const store = kv();
    await run(post(event, { "cf-connecting-ip": "203.0.113.1", "User-Agent": "Mozilla/5.0 (X11; Linux)", Cookie: "sid=abc" }), env(store));
    await run(post(event, { "cf-connecting-ip": "198.51.100.99", "User-Agent": "curl/8", "Accept-Language": "si-LK" }), env(store));
    expect([...store.store.entries()]).toEqual([["m|2026-10-03|repo_click|/projects/fetch-php|linkedin|social|release-x|social|project=fetch-php", "2"]]);
    const everything = JSON.stringify([...store.store.entries()]);
    for (const secret of ["203.0.113", "198.51.100", "Mozilla", "curl", "si-LK", "sid=abc", "12:34"]) expect(everything).not.toContain(secret);
  });

  it("never logs the body, IP, user agent or cookies", async () => {
    const logs: string[] = [];
    await run(post(event, { "cf-connecting-ip": "203.0.113.55", "User-Agent": "UA-SENTINEL", Cookie: "sid=COOKIE-SENTINEL" }), env(kv()), logs);
    await run(post("BODY-SENTINEL-not-json", { "cf-connecting-ip": "203.0.113.56" }), env(kv()), logs);
    const combined = logs.join("\n");
    for (const forbidden of ["203.0.113", "UA-SENTINEL", "COOKIE-SENTINEL", "BODY-SENTINEL", "linkedin", "release-x", "fetch-php"]) expect(combined, forbidden).not.toContain(forbidden);
    expect(JSON.parse(logs[0])).toMatchObject({ msg: "request", method: "POST", path: "/collect", status: 204 });
  });

  it("sets no cookies and no tracking-relevant headers", async () => {
    const response = await run(post(event), env(kv()));
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("Workers runtime compatibility", () => {
  it("the entry module exports only handlers (plain-value exports make workerd refuse to start)", async () => {
    const entry = await import("@workers/site-metrics/index");
    for (const [name, value] of Object.entries(entry)) {
      expect(["function", "object"], `${name} must be a handler, not a plain value`).toContain(typeof value);
      expect(typeof value, name).not.toBe("number");
      expect(typeof value, name).not.toBe("string");
    }
    expect(Object.keys(entry).sort()).toEqual(["default", "handleRequest"]);
  });
});

describe("health", () => {
  it("reports status and version without touching storage", async () => {
    let touched = false;
    const spy = kv({ get: async () => { touched = true; return null; } });
    const response = await run(new Request("https://m.example/healthz"), env(spy, { WORKER_VERSION: "abc1234" }));
    expect(await response.json()).toEqual({ status: "ok", version: "abc1234" });
    expect(touched).toBe(false);
  });
});

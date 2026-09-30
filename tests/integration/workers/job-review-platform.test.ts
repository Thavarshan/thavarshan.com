// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleRequest, limiters, routes, type Env, type KVLike } from "@workers/job-review/index";
import {
  MAX_BODY_BYTES,
  PayloadTooLargeError,
  RateLimiter,
  UnsupportedMediaTypeError,
  fetchJsonBounded,
  formatLog,
  readFormBody,
  requestIdFor
} from "@/shared/edge/platform";
import { makeOpportunity } from "../../helpers/opportunity";
import type { OpportunitySnapshot } from "@/features/jobs/opportunities";

const ID = "0123456789abcdef0123";
const now = new Date("2026-09-30T00:00:00.000Z");
const snapshot: OpportunitySnapshot = {
  schemaVersion: 2,
  generatedAt: "2026-09-29T12:00:00.000Z",
  collectorVersion: null,
  candidate: { location: "Sri Lanka", preferredStack: [], experienceYears: 11, workModes: ["remote"] },
  sources: [],
  opportunities: [makeOpportunity({ id: ID, canonicalUrl: "https://larajobs.com/job/1", title: "Laravel Dev", eligibility: "eligible", score: 80 })]
};
const dataFetcher = (async () => new Response(JSON.stringify(snapshot))) as typeof fetch;

function kv(overrides: Partial<KVLike> = {}): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return { store, get: async (key) => store.get(key) ?? null, put: async (key, value) => void store.set(key, value), ...overrides };
}
const env = (store: KVLike, extra: Partial<Env> = {}): Env => ({
  JOBS_KV: store,
  JOBS_DATA_URL: "https://data.example/jobs.json",
  DEV_AUTH_BYPASS: "1",
  ...extra
});
const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request("http://localhost/review", {
    method: "POST",
    headers: { Origin: "http://localhost", "cf-connecting-ip": `t${Math.random()}`, ...headers },
    body: new URLSearchParams(fields)
  });
const get = (path = "/", headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers: { "cf-connecting-ip": `t${Math.random()}`, ...headers } });
const run = (request: Request, environment: Env, logs: string[] = []) =>
  handleRequest(request, environment, { fetcher: dataFetcher, now, log: (line) => logs.push(line) });

describe("health endpoint", () => {
  it("reports status, version and environment, and degrades honestly when KV is down", async () => {
    const ok = await run(get("/healthz"), env(kv(), { WORKER_VERSION: "abc1234" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "ok", version: "abc1234", environment: "production", kv: "ok" });

    const down = await run(
      get("/healthz"),
      env(
        kv({
          get: async () => {
            throw new Error("kv down");
          }
        }),
        { READ_ONLY: "1" }
      )
    );
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ status: "degraded", environment: "preview", kv: "unavailable" });
  });

  it("is behind the same authorization as everything else", async () => {
    const response = await run(get("/healthz"), { JOBS_KV: kv(), JOBS_DATA_URL: "https://x" });
    expect(response.status).toBe(403);
  });
});

describe("request ids and structured logs", () => {
  it("sets X-Request-Id (preferring the Cloudflare ray) and logs one JSON line per request", async () => {
    const logs: string[] = [];
    const response = await run(get("/healthz", { "cf-ray": "8a1b2c3d4e5f6789-CMB" }), env(kv()), logs);
    expect(response.headers.get("X-Request-Id")).toBe("8a1b2c3d4e5f6789-CMB");
    const entry = JSON.parse(logs.at(-1)!);
    expect(entry).toMatchObject({ level: "info", msg: "request", requestId: "8a1b2c3d4e5f6789-CMB", method: "GET", path: "/healthz", status: 200 });
    expect(typeof entry.durationMs).toBe("number");
  });

  it("generates an id when the ray header is absent or malformed", () => {
    expect(requestIdFor(new Request("http://x"), () => "generated")).toBe("generated");
    expect(requestIdFor(new Request("http://x", { headers: { "cf-ray": "bad value!" } }), () => "generated")).toBe("generated");
  });

  it("never logs notes, emails, tokens or query strings", async () => {
    const logs: string[] = [];
    const store = kv();
    await run(post({ id: ID, status: "reviewed", note: "SECRET NOTE about Acme" }), env(store), logs);
    await run(get("/?tech=secret-search", { "Cf-Access-Jwt-Assertion": "TOKEN123" }), env(store), logs);
    const combined = logs.join("\n");
    for (const forbidden of ["SECRET NOTE", "secret-search", "TOKEN123"]) expect(combined).not.toContain(forbidden);
    expect(formatLog({ level: "info", msg: "x", requestId: "r", note: "n", Email: "e@x.com", token: "t", keep: 1 })).toBe(
      '{"level":"info","msg":"x","requestId":"r","keep":1}'
    );
  });

  it("returns a generic 500 and logs the error when something unexpected throws", async () => {
    const logs: string[] = [];
    const response = await handleRequest(get("/"), env(kv()), {
      fetcher: (() => {
        throw new Error("boom");
      }) as never,
      now,
      log: (line) => logs.push(line)
    });
    expect([500, 502]).toContain(response.status);
    expect(logs.join("\n")).not.toContain("SECRET");
  });
});

describe("route ownership, methods and CORS", () => {
  it("owns exactly three routes, and everything else is 404", async () => {
    expect(routes.map((entry) => `${entry.method} ${entry.path}`)).toEqual(["GET /", "POST /review", "GET /healthz"]);
    expect((await run(get("/admin"), env(kv()))).status).toBe(404);
    expect((await run(get("/review"), env(kv()))).status).toBe(405);
  });

  it("supports no CORS: preflight is refused and no Access-Control-Allow-* header is ever sent", async () => {
    const preflight = await run(
      new Request("http://localhost/review", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST", "cf-connecting-ip": "p1" }
      }),
      env(kv())
    );
    expect(preflight.status).toBe(405);
    for (const response of [preflight, await run(get("/"), env(kv())), await run(get("/healthz"), env(kv()))]) {
      expect([...response.headers.keys()].filter((name) => name.startsWith("access-control-"))).toEqual([]);
      expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
      expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    }
  });
});

describe("bounded, validated input", () => {
  it("rejects oversized bodies (declared and streamed) and non-form content types", async () => {
    const big = "x".repeat(MAX_BODY_BYTES + 1);
    expect((await run(post({ id: ID, status: "reviewed", note: big }), env(kv()))).status).toBe(413);

    const streamed = new Request("http://localhost/review", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/x-www-form-urlencoded", "cf-connecting-ip": "s1" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("id=" + "a".repeat(MAX_BODY_BYTES + 50)));
          controller.close();
        }
      }),
      duplex: "half"
    } as RequestInit);
    await expect(readFormBody(streamed)).rejects.toThrow(PayloadTooLargeError);

    const json = new Request("http://localhost/review", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json", "cf-connecting-ip": "j1" },
      body: "{}"
    });
    expect((await run(json, env(kv()))).status).toBe(415);
    await expect(readFormBody(new Request("http://x", { method: "POST", body: "a=b", headers: { "Content-Type": "text/plain" } }))).rejects.toThrow(
      UnsupportedMediaTypeError
    );
  });

  it("bounds the upstream data fetch by time and size", async () => {
    const slow = ((_: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    await expect(fetchJsonBounded("https://x", slow, { timeoutMs: 20 })).rejects.toThrow();
    const huge = (async () => new Response("[" + "1,".repeat(100) + "1]", { headers: { "content-length": "999999999" } })) as typeof fetch;
    await expect(fetchJsonBounded("https://x", huge, { maxBytes: 1000 })).rejects.toThrow(/too large/);
    const unlabeled = (async () => new Response("x".repeat(2000))) as typeof fetch;
    await expect(fetchJsonBounded("https://x", unlabeled, { maxBytes: 1000 })).rejects.toThrow(/too large/);
    expect(await fetchJsonBounded("https://x", (async () => new Response('{"ok":true}')) as typeof fetch)).toEqual({ ok: true });
  });

  describe("streams the upstream body and stops at the byte limit", () => {
    const encoder = new TextEncoder();
    function streamOf(chunks: Uint8Array[], headers: HeadersInit = {}) {
      let index = 0;
      const state = { cancelled: false, pulled: 0 };
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            if (index >= chunks.length) return controller.close();
            state.pulled += 1;
            controller.enqueue(chunks[index++]);
          },
          cancel() {
            state.cancelled = true;
          }
        },
        { highWaterMark: 0 }
      );
      return { state, fetcher: (async () => new Response(body, { headers })) as typeof fetch };
    }

    it("cancels the reader and never reads the rest once the limit is exceeded, with no Content-Length", async () => {
      const chunks = Array.from({ length: 50 }, () => encoder.encode("x".repeat(100)));
      const { state, fetcher } = streamOf(chunks);
      await expect(fetchJsonBounded("https://x", fetcher, { maxBytes: 250 })).rejects.toThrow(/too large/);
      expect(state.cancelled).toBe(true);
      expect(state.pulled).toBeLessThan(10);
    });

    it("rejects an understated Content-Length by actual bytes", async () => {
      const { state, fetcher } = streamOf([encoder.encode("x".repeat(400))], { "content-length": "10" });
      await expect(fetchJsonBounded("https://x", fetcher, { maxBytes: 100 })).rejects.toThrow(/too large/);
      expect(state.cancelled).toBe(true);
    });

    it("rejects an honest oversized Content-Length without reading the body", async () => {
      const { state, fetcher } = streamOf([encoder.encode("[]")], { "content-length": "5000" });
      await expect(fetchJsonBounded("https://x", fetcher, { maxBytes: 100 })).rejects.toThrow(/too large/);
      expect(state.pulled).toBe(0);
      expect(state.cancelled).toBe(true);
    });

    it("counts bytes, not characters, for non-ASCII content", async () => {
      // 60 characters but 180 bytes.
      const text = JSON.stringify("€".repeat(58));
      expect(text.length).toBeLessThanOrEqual(100);
      expect(encoder.encode(text).length).toBeGreaterThan(100);
      await expect(fetchJsonBounded("https://x", streamOf([encoder.encode(text)]).fetcher, { maxBytes: 100 })).rejects.toThrow(/too large/);
    });

    it("reassembles multi-byte characters split across chunks", async () => {
      const bytes = encoder.encode(JSON.stringify({ city: "Colombo – Ceylon €" }));
      const { fetcher } = streamOf([bytes.slice(0, 15), bytes.slice(15, 26), bytes.slice(26)]);
      expect(await fetchJsonBounded("https://x", fetcher, { maxBytes: 1000 })).toEqual({ city: "Colombo – Ceylon €" });
    });

    it("accepts a body exactly at the limit", async () => {
      const text = '{"a":"bbbb"}';
      expect(await fetchJsonBounded("https://x", streamOf([encoder.encode(text)]).fetcher, { maxBytes: encoder.encode(text).length })).toEqual({ a: "bbbb" });
    });

    it("fails cleanly on an empty or missing body without echoing upstream content", async () => {
      await expect(fetchJsonBounded("https://x", (async () => new Response(null)) as typeof fetch)).rejects.toThrow(/empty|unreadable/i);
      await expect(fetchJsonBounded("https://x", (async () => new Response("")) as typeof fetch)).rejects.toThrow(/empty|unreadable/i);
      await expect(fetchJsonBounded("https://x", (async () => new Response("<html>secret-token</html>")) as typeof fetch)).rejects.not.toThrow(/secret-token/);
    });

    it("reports a failing stream as unreadable and cancels", async () => {
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("socket reset with secret-token"));
        }
      });
      const error = await fetchJsonBounded("https://x", (async () => new Response(body)) as typeof fetch).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/unreadable/i);
      expect((error as Error).message).not.toMatch(/secret-token/);
    });
  });
});

describe("rate limiting", () => {
  it("allows a burst up to the limit, then answers 429 with Retry-After, per client", async () => {
    limiters.write = new RateLimiter(3, 60_000);
    const store = kv();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await run(post({ id: ID, status: "reviewed" }, { "cf-connecting-ip": "203.0.113.9" }), env(store))).status);
    expect(statuses).toEqual([303, 303, 303, 429, 429]);
    const limited = await run(post({ id: ID, status: "reviewed" }, { "cf-connecting-ip": "203.0.113.9" }), env(store));
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await run(post({ id: ID, status: "reviewed" }, { "cf-connecting-ip": "198.51.100.1" }), env(store))).status).toBe(303);
    limiters.write = new RateLimiter(30, 60_000);
  });

  it("uses a sliding window and stays memory-bounded", () => {
    let clock = 0;
    const limiter = new RateLimiter(2, 1000, () => clock);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a")).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    clock = 1001;
    expect(limiter.check("a").allowed).toBe(true);
    for (let i = 0; i < 1200; i++) limiter.check(`k${i}`);
    clock = 5000;
    limiter.check("trigger");
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThan(1200);
  });
});

describe("graceful degradation and data safety", () => {
  it("never overwrites saved reviews when the store cannot be read", async () => {
    const store = kv();
    store.store.set("reviews", JSON.stringify({ [ID]: { status: "shortlisted", note: "keep me", updatedAt: "x" } }));
    let writes = 0;
    const flaky = kv({
      get: async () => {
        throw new Error("kv read failed");
      },
      put: async () => {
        writes++;
      }
    });
    const response = await run(post({ id: "aaaaaaaaaaaaaaaaaaaa", status: "reviewed" }), env(flaky));
    expect(response.status).toBe(503);
    expect(writes).toBe(0);
  });

  it("reports a failed write as 503 instead of pretending it saved", async () => {
    const failing = kv({
      put: async () => {
        throw new Error("quota");
      }
    });
    const response = await run(post({ id: ID, status: "reviewed" }), env(failing));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("nothing was saved");
  });

  it("still renders the list, with a notice, when saved reviews are unavailable", async () => {
    const response = await run(
      get("/"),
      env(
        kv({
          get: async () => {
            throw new Error("kv down");
          }
        })
      )
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Laravel Dev");
    expect(html).toContain("Saved reviews are temporarily unavailable");
  });

  describe("malformed persisted review state", () => {
    const malformed = [
      "null",
      "[]",
      '"text"',
      "42",
      "{not json",
      JSON.stringify({ [ID]: null }),
      JSON.stringify({ [ID]: { status: "archived", note: "", updatedAt: "x" } })
    ];

    it.each(malformed)("shows the degraded notice on GET and keeps the blob: %s", async (blob) => {
      const store = kv();
      store.store.set("reviews", blob);
      const response = await run(get("/"), env(store));
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain("Laravel Dev");
      expect(html).toContain("Saved reviews are temporarily unavailable");
      expect(store.store.get("reviews")).toBe(blob);
    });

    it.each(malformed)("refuses to write on POST and preserves the stored blob: %s", async (blob) => {
      let writes = 0;
      const store = kv({
        put: async () => {
          writes++;
        }
      });
      store.store.set("reviews", blob);
      const response = await run(post({ id: ID, status: "reviewed" }), env(store));
      expect(response.status).toBe(503);
      expect(writes).toBe(0);
      expect(store.store.get("reviews")).toBe(blob);
    });

    it("reports health as degraded", async () => {
      const store = kv();
      store.store.set("reviews", "null");
      const response = await run(get("/healthz"), env(store));
      expect(await response.json()).toMatchObject({ status: "degraded", kv: "unavailable" });
    });

    it("still reads and writes valid saved state", async () => {
      const store = kv();
      store.store.set("reviews", JSON.stringify({ [ID]: { status: "shortlisted", note: "keep", updatedAt: "2026-09-29T12:00:00.000Z" } }));
      expect(await (await run(get("/"), env(store))).text()).not.toContain("Saved reviews are temporarily unavailable");
      const saved = await run(post({ id: ID, status: "reviewed", note: "updated" }), env(store));
      expect(saved.status).toBeLessThan(400);
      expect(JSON.parse(store.store.get("reviews")!)[ID]).toMatchObject({ status: "reviewed", note: "updated" });
    });
  });
});

describe("read-only preview mode", () => {
  it("refuses writes, disables the save controls and says so", async () => {
    const store = kv();
    const write = await run(post({ id: ID, status: "reviewed" }), env(store, { READ_ONLY: "1" }));
    expect(write.status).toBe(403);
    expect(store.store.size).toBe(0);
    const html = await (await run(get("/"), env(store, { READ_ONLY: "1" }))).text();
    expect(html).toContain("Preview version");
    expect(html).toMatch(/<button type="submit" disabled>Save<\/button>/);
  });
});

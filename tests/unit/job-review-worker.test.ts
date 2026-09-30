// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { clearAccessCertCache, verifyAccessJwt } from "@/workers/job-review/access";
import { handleRequest, type Env, type KVLike } from "@/workers/job-review/index";
import type { OpportunitySnapshot } from "@/lib/job-opportunities";

const TEAM = "team.cloudflareaccess.com";
const AUD = "aud-tag";
const EMAIL = "me@example.com";
const now = new Date("2026-09-30T00:00:00.000Z");

const b64url = (input: string | ArrayBuffer) =>
  Buffer.from(typeof input === "string" ? input : new Uint8Array(input)).toString("base64url");

async function makeIdentity() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
  const fetcher = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as typeof fetch;
  const sign = async (payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "k1" }) => {
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(signingInput));
    return `${signingInput}.${b64url(signature)}`;
  };
  return { fetcher, sign };
}

const goodClaims = { aud: [AUD], iss: `https://${TEAM}`, email: EMAIL, exp: now.getTime() / 1000 + 600 };
const config = { teamDomain: TEAM, audience: AUD, allowedEmail: EMAIL };

describe("verifyAccessJwt", () => {
  beforeEach(() => clearAccessCertCache());

  it("accepts a valid token and rejects tampering, wrong aud/iss/email, expiry and alg confusion", async () => {
    const { fetcher, sign } = await makeIdentity();
    const verify = (token: string | null) => verifyAccessJwt(token, config, { fetcher, now: now.getTime() });

    expect(await verify(await sign(goodClaims))).toBe(EMAIL);
    expect(await verify(null)).toBeNull();
    expect(await verify(`${await sign(goodClaims)}x`)).toBeNull();
    expect(await verify(await sign({ ...goodClaims, aud: ["other"] }))).toBeNull();
    expect(await verify(await sign({ ...goodClaims, iss: "https://evil.example" }))).toBeNull();
    expect(await verify(await sign({ ...goodClaims, email: "attacker@example.com" }))).toBeNull();
    expect(await verify(await sign({ ...goodClaims, exp: now.getTime() / 1000 - 1 }))).toBeNull();
    expect(await verify(await sign(goodClaims, { alg: "none", kid: "k1" }))).toBeNull();
    expect(await verify(await sign(goodClaims, { alg: "RS256", kid: "unknown" }))).toBeNull();
  });
});

function fakeKv(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return { store, get: async (key) => store.get(key) ?? null, put: async (key, value) => void store.set(key, value) };
}

const ID = "0123456789abcdef0123";
const snapshot: OpportunitySnapshot = {
  schemaVersion: 2,
  generatedAt: "2026-09-29T12:00:00.000Z",
  candidate: { location: "Sri Lanka", preferredStack: [], experienceYears: 11, workModes: ["remote"] },
  sources: [],
  opportunities: [{
    id: ID, source: "larajobs", sourceUrl: "https://larajobs.com/feed", canonicalUrl: "https://larajobs.com/job/1",
    title: "Senior <b>Laravel</b> Dev", company: "Acme", location: null, workArrangement: "unknown", employmentType: null,
    seniority: "senior", salary: null, salaryMin: null, salaryMax: null, salaryCurrency: null, descriptionText: "",
    tags: ["laravel"], contentFingerprint: "f", duplicateOfIds: [], publishedAt: "2026-09-28T00:00:00.000Z",
    firstSeenAt: "2026-09-28T00:00:00.000Z", lastSeenAt: "2026-09-29T00:00:00.000Z", status: "active", closedAt: null,
    eligibility: "eligible", sponsorship: "unknown", score: 80, reasons: ["Laravel is explicitly required"], concerns: [],
    scoreBreakdown: [{ factor: "Baseline", points: 10 }]
  }]
};
const dataFetcher = (async () => new Response(JSON.stringify(snapshot))) as typeof fetch;

describe("job-review worker", () => {
  const devEnv = (kv: KVLike): Env => ({ JOBS_KV: kv, JOBS_DATA_URL: "https://data.example/jobs.json", DEV_AUTH_BYPASS: "1" });

  it("fails closed when Access is not configured or no token is present", async () => {
    const env: Env = { JOBS_KV: fakeKv(), JOBS_DATA_URL: "https://data.example/jobs.json" };
    expect((await handleRequest(new Request("https://jobs.example/"), env, { fetcher: dataFetcher, now })).status).toBe(403);
    const configured = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAIL: EMAIL };
    expect((await handleRequest(new Request("https://jobs.example/"), configured, { fetcher: dataFetcher, now })).status).toBe(403);
  });

  it("ignores the dev bypass for non-localhost hosts", async () => {
    const response = await handleRequest(new Request("https://jobs.example/"), devEnv(fakeKv()), { fetcher: dataFetcher, now });
    expect(response.status).toBe(403);
  });

  it("renders escaped, noindex, private-cache pages", async () => {
    const response = await handleRequest(new Request("http://localhost/"), devEnv(fakeKv()), { fetcher: dataFetcher, now });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(html).toContain("Senior &lt;b&gt;Laravel&lt;/b&gt; Dev");
    expect(html).not.toContain("<b>Laravel</b>");
    expect(html).toContain("Why this score");
    expect(html).toContain("Sponsorship: unknown");
  });

  it("shows a stale banner and an error state instead of crashing", async () => {
    const stale = await handleRequest(new Request("http://localhost/"), devEnv(fakeKv()), { fetcher: dataFetcher, now: new Date("2026-10-10T00:00:00.000Z") });
    expect(await stale.text()).toContain("looks stale");
    const broken = await handleRequest(new Request("http://localhost/"), devEnv(fakeKv()), { fetcher: (async () => new Response("{}")) as typeof fetch, now });
    expect(broken.status).toBe(502);
    expect(await broken.text()).toContain("unavailable");
  });

  it("persists review state to KV only, and validates input", async () => {
    const kv = fakeKv();
    const post = (fields: Record<string, string>, origin = "http://localhost") =>
      handleRequest(new Request("http://localhost/review", { method: "POST", headers: { Origin: origin }, body: new URLSearchParams(fields) }), devEnv(kv), { fetcher: dataFetcher, now });

    const ok = await post({ id: ID, status: "shortlisted", note: "call Monday", return: "min=50&evil=<x>" });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("Location")).toBe(`/?min=50&evil=%3Cx%3E#job-${ID}`);
    expect(JSON.parse(kv.store.get("reviews")!)[ID]).toMatchObject({ status: "shortlisted", note: "call Monday" });

    const page = await (await handleRequest(new Request("http://localhost/?review=shortlisted"), devEnv(kv), { fetcher: dataFetcher, now })).text();
    expect(page).toContain("call Monday");

    expect((await post({ id: "../etc", status: "reviewed" })).status).toBe(400);
    expect((await post({ id: ID, status: "hacked" })).status).toBe(400);
    expect((await post({ id: ID, status: "reviewed" }, "https://evil.example")).status).toBe(403);

    await post({ id: ID, status: "new", note: "" });
    expect(JSON.parse(kv.store.get("reviews")!)[ID]).toBeUndefined();
  });
});

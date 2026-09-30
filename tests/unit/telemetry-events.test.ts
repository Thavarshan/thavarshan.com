// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EVENTS, aggregateKey, attributionFromSearch, classifyReferrer, eventNames, parseAggregateKey, sanitizeUtm, stageOf, validateWireEvent } from "@/features/telemetry/events";
import { goalToEvent, locationFromPath, projectFromHref } from "@/features/telemetry/goals";

const base = { path: "/projects/fetch-php", source: null, medium: null, campaign: null, referrer: "direct", props: {} };
const valid = (event: string, props: Record<string, string> = {}, extra: Record<string, unknown> = {}) => validateWireEvent({ ...base, event, props, ...extra });

describe("taxonomy", () => {
  it("covers every high-intent action the issue names, split into engagement and intent", () => {
    for (const name of ["repo_click", "demo_click", "cv_download", "contact_cta", "consulting_cta", "hire_cta", "tool_completed"] as const) expect(stageOf(name), name).toBe("intent");
    for (const name of ["profile_click", "insight_read", "newsletter_click"] as const) expect(stageOf(name), name).toBe("engagement");
    expect(eventNames.length).toBe(Object.keys(EVENTS).length);
  });
});

describe("validateWireEvent: strict allowlist at the trust boundary", () => {
  it("accepts well-formed events", () => {
    expect(valid("repo_click", { project: "fetch-php" }).ok).toBe(true);
    expect(valid("cv_download", { location: "home" }, { source: "linkedin", medium: "social", campaign: "release-fetch-php-3-9-0", referrer: "social" }).ok).toBe(true);
    expect(valid("profile_click", { network: "github" }).ok).toBe(true);
    expect(valid("newsletter_click").ok).toBe(true);
  });

  it.each([
    ["an unknown event", () => valid("purchase", {})],
    ["a prototype-pollution event name", () => valid("__proto__", {})],
    ["a constructor event name", () => valid("constructor", {})],
    ["a missing required property", () => valid("repo_click", {})],
    ["an unexpected property (nowhere to put free text)", () => valid("repo_click", { project: "x", note: "hi" })],
    ["an unknown enum value", () => valid("profile_click", { network: "myspace" })],
    ["free text in a slug property", () => valid("repo_click", { project: "a@b.com" })],
    ["an uppercase/space/long slug", () => valid("repo_click", { project: "Has Space" })],
    ["an over-long slug", () => valid("repo_click", { project: "a".repeat(81) })],
    ["a path with a query string", () => valid("cv_download", {}, { path: "/cv?email=a@b.com" })],
    ["a path with a fragment", () => valid("cv_download", {}, { path: "/cv#x" })],
    ["a non-path", () => valid("cv_download", {}, { path: "https://evil.example/" })],
    ["an over-long path", () => valid("cv_download", {}, { path: `/${"a".repeat(130)}` })],
    ["a path-traversal path", () => valid("cv_download", {}, { path: "/../../etc/passwd" })],
    ["a UTM value with spaces or symbols", () => valid("cv_download", {}, { campaign: "spring sale!" })],
    ["an uppercase UTM value (must be normalised before sending)", () => valid("cv_download", {}, { source: "LinkedIn" })],
    ["an unknown referrer class", () => valid("cv_download", {}, { referrer: "https://evil.example/x?y=1" })],
    ["an extra top-level field (e.g. a visitor id)", () => valid("cv_download", {}, { visitorId: "abc" })],
    ["props as an array", () => valid("cv_download", [] as unknown as Record<string, string>)],
    ["a non-object body", () => validateWireEvent("cv_download")],
    ["null", () => validateWireEvent(null)],
    ["an array", () => validateWireEvent([])]
  ])("rejects %s", (_name, run) => {
    expect(run().ok).toBe(false);
  });

  it("FUZZ: no random free-text value is ever accepted in a property", () => {
    let seed = 99;
    const rand = (n: number) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    const alphabet = "abcXYZ019 -_@.:/?=&#%\n\t<>'\"{}[]|\\😀";
    let accepted = 0;
    for (let i = 0; i < 3000; i++) {
      const text = Array.from({ length: 1 + rand(60) }, () => alphabet[rand(alphabet.length)]).join("");
      const result = valid("repo_click", { project: text });
      if (result.ok) { accepted++; expect(text).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/); }
    }
    expect(accepted).toBeLessThan(3000);
  });
});

describe("real content slugs", () => {
  it("accepts every published Insight slug (they are longer than 40 characters)", async () => {
    const { readdirSync } = await import("node:fs");
    const slugs = readdirSync("content/insights").filter((file) => file.endsWith(".mdx")).map((file) => file.replace(/\.mdx$/, ""));
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.some((value) => value.length > 40)).toBe(true);
    for (const value of slugs) expect(valid("insight_read", { slug: value }).ok, value).toBe(true);
  });

  it("keeps page locations short", () => {
    expect(valid("cv_download", { location: "a".repeat(41) }).ok).toBe(false);
  });
});

describe("attribution", () => {
  it("sanitises UTM values, since anyone can craft a link", () => {
    expect(sanitizeUtm(" LinkedIn ")).toBe("linkedin");
    expect(sanitizeUtm("release-fetch-php-3-9-0")).toBe("release-fetch-php-3-9-0");
    for (const bad of ["a b", "x".repeat(61), "<script>", "a@b.com", "", "-lead", null, undefined]) expect(sanitizeUtm(bad as string), String(bad)).toBeNull();
  });

  it("reads UTM from a query string", () => {
    expect(attributionFromSearch("?utm_source=LinkedIn&utm_medium=social&utm_campaign=x&other=1")).toEqual({ source: "linkedin", medium: "social", campaign: "x" });
    expect(attributionFromSearch("?utm_source=a b&utm_campaign=ok")).toEqual({ source: null, medium: null, campaign: "ok" });
    expect(attributionFromSearch("")).toEqual({ source: null, medium: null, campaign: null });
  });

  it("classifies referrers into coarse classes and never keeps a URL", () => {
    const own = "thavarshan.com";
    const cases: Array<[string, string]> = [
      ["", "direct"], ["https://www.google.com/search?q=secret+query", "search"], ["https://duckduckgo.com/", "search"],
      ["https://www.linkedin.com/feed/", "social"], ["https://lnkd.in/abc", "social"], ["https://t.co/xyz", "social"],
      ["https://github.com/Thavarshan/fetch-php", "code"], ["https://packagist.org/packages/x", "code"],
      ["https://www.reddit.com/r/laravel/", "community"], ["https://dev.to/x", "community"], ["https://laravel-news.com/", "community"],
      ["https://thavarshan.com/insights", "internal"], ["https://www.thavarshan.com/", "internal"],
      ["https://random-blog.example/post", "other"], ["not a url", "other"]
    ];
    for (const [referrer, expected] of cases) expect(classifyReferrer(referrer, own), referrer).toBe(expected);
    expect(classifyReferrer("https://notlinkedin.com.evil.example/", own)).toBe("other");
  });
});

describe("aggregate keys", () => {
  it("round-trips and contains nothing per-visitor", () => {
    const parsed = valid("repo_click", { project: "fetch-php" }, { source: "linkedin", medium: "social", campaign: "c1", referrer: "social" });
    if (!parsed.ok) throw new Error("setup");
    const key = aggregateKey("2026-10-01", parsed.event);
    expect(key).toBe("m|2026-10-01|repo_click|/projects/fetch-php|linkedin|social|c1|social|project=fetch-php");
    expect(parseAggregateKey(key)).toEqual({ ...parsed.event, day: "2026-10-01" });
  });

  it("rejects malformed or forged keys", () => {
    for (const key of ["", "x|y", "m|2026-10-01|nope|/|-|-|-|direct|-", "m|bad-date|repo_click|/|-|-|-|direct|project=x", "m|2026-10-01|repo_click|/|-|-|-|direct|-"]) expect(parseAggregateKey(key), key).toBeNull();
  });
});

describe("call-to-action vocabulary -> taxonomy", () => {
  it("maps each goal, deriving properties from where the click happened", () => {
    expect(goalToEvent("Contact", "mailto:x@y.z", "/cv")).toEqual({ name: "contact_cta", props: { location: "cv" } });
    expect(goalToEvent("Resume Download", "/docs/Jerome-Resume.pdf", "/")).toEqual({ name: "cv_download", props: { location: "home" } });
    expect(goalToEvent("LinkedIn Visit", "https://linkedin.com/in/x", "/")).toEqual({ name: "profile_click", props: { network: "linkedin" } });
    expect(goalToEvent("GitHub Visit", "https://github.com/Thavarshan", "/")).toEqual({ name: "profile_click", props: { network: "github" } });
    expect(goalToEvent("Repository Visit", "https://github.com/Thavarshan/Fetch-PHP", "/projects")).toEqual({ name: "repo_click", props: { project: "fetch-php" } });
    expect(goalToEvent("Repository Visit", "https://example.com/x", "/projects/matrix")).toEqual({ name: "repo_click", props: { project: "matrix" } });
    expect(goalToEvent("Repository Visit", "https://example.com/x", "/")).toBeNull();
  });

  it("every mapped event is valid under the wire schema", () => {
    for (const goal of ["Contact", "Resume Download", "LinkedIn Visit", "GitHub Visit", "Repository Visit", "Newsletter Visit"] as const) {
      const tracked = goalToEvent(goal, "https://github.com/Thavarshan/fetch-php", "/projects/fetch-php");
      if (!tracked) continue;
      expect(validateWireEvent({ ...base, event: tracked.name, props: tracked.props ?? {} }).ok, goal).toBe(true);
    }
  });

  it("derives safe locations and projects", () => {
    expect(locationFromPath("/")).toBe("home");
    expect(locationFromPath("/insights/some-article")).toBe("insights");
    expect(locationFromPath("/Weird Path")).toBe("other");
    expect(projectFromHref("/projects/fetch-php", "/")).toBe("fetch-php");
    expect(projectFromHref("https://github.com/o", "/")).toBeNull();
  });
});

describe("documentation does not drift from the taxonomy", () => {
  it("docs/measurement.md lists every event and its stage", async () => {
    const { readFileSync } = await import("node:fs");
    const docs = readFileSync("docs/measurement.md", "utf8");
    for (const name of eventNames) {
      const line = docs.split("\n").find((entry) => entry.startsWith(`| \`${name}\``));
      expect(line, `${name} is missing from docs/measurement.md`).toBeTruthy();
      expect(line, name).toContain(stageOf(name));
    }
  });
});

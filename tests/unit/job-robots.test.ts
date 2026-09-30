import { describe, expect, it } from "vitest";
import { createRobotsGuard, isPathAllowed, parseRobots } from "@scripts/jobs/robots";

const allowed = (text: string, path: string, agent = "JeromeJobCollector") => isPathAllowed(parseRobots(text, agent), path);

describe("robots.txt parsing and matching", () => {
  it("treats an empty Disallow as allow-all", () => {
    expect(allowed("User-agent: *\nDisallow:\n", "/anything")).toBe(true);
  });

  it("applies simple Disallow prefixes", () => {
    const text = "User-agent: *\nDisallow: /api/\nDisallow: /account/\n";
    expect(allowed(text, "/api/jobs")).toBe(false);
    expect(allowed(text, "/account/settings")).toBe(false);
    expect(allowed(text, "/news/post")).toBe(true);
  });

  it("supports * wildcards and $ anchors", () => {
    const text = "User-agent: *\nDisallow: /*search=\nDisallow: /private$\nDisallow: /api/*\n";
    expect(allowed(text, "/jobs?search=laravel")).toBe(false);
    expect(allowed(text, "/private")).toBe(false);
    expect(allowed(text, "/private/page")).toBe(true);
    expect(allowed(text, "/api/remote-jobs?category=x")).toBe(false);
  });

  it("uses the longest matching rule, with Allow winning ties", () => {
    const text = "User-agent: *\nDisallow: /admin/\nAllow: /admin/public/\n";
    expect(allowed(text, "/admin/secret")).toBe(false);
    expect(allowed(text, "/admin/public/page")).toBe(true);
    expect(allowed("User-agent: *\nAllow: /x\nDisallow: /x\n", "/x")).toBe(true);
  });

  it("prefers a specific agent group over *, and ignores comments and unknown fields", () => {
    const text = "# hi\nUser-agent: *\nDisallow: /\n\nUser-agent: JeromeJobCollector # us\nAllow: /\nCrawl-delay: 5\nSitemap: https://x/sitemap.xml\n";
    expect(allowed(text, "/jobs")).toBe(true);
    expect(allowed(text, "/jobs", "OtherBot")).toBe(false);
  });

  it("groups consecutive user-agent lines and ignores rules before any group", () => {
    const text = "Disallow: /orphan\nUser-agent: a\nUser-agent: JeromeJobCollector\nDisallow: /shared\n";
    expect(allowed(text, "/shared")).toBe(false);
    expect(allowed(text, "/orphan")).toBe(true);
  });

  it("copes with the real Remotive/Laravel News/WeWorkRemotely robots.txt shapes", () => {
    const remotive = "\n        User-agent: *\n        Sitemap:https://remotive.com/sitemap.xml\n\n        User-agent: *\n        Disallow: /api/*\n        Disallow: /jobs/*\n        Disallow: /*search=\n";
    expect(allowed(remotive, "/api/remote-jobs?category=software-dev")).toBe(false);
    expect(allowed(remotive, "/remote-jobs/software-development")).toBe(true);
    const news = "User-agent: *\nDisallow: /api/\nDisallow: /account/\n";
    expect(allowed(news, "/")).toBe(true);
    const wwr = "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /*edit?token=/\n";
    expect(allowed(wwr, "/categories/remote-programming-jobs.rss")).toBe(true);
    expect(allowed(wwr, "/admin/x")).toBe(false);
  });
});

describe("createRobotsGuard", () => {
  const respond = (status: number, body = "") => async () => ({ status, text: async () => body });

  it("allows when robots.txt permits, blocks when it disallows", async () => {
    const guard = createRobotsGuard(respond(200, "User-agent: *\nDisallow: /private/\n"), "JeromeJobCollector");
    expect(await guard.isAllowed("https://example.com/jobs/1")).toBe(true);
    expect(await guard.isAllowed("https://example.com/private/x")).toBe(false);
  });

  it("allows everything when robots.txt is missing (4xx), per the RFC", async () => {
    const guard = createRobotsGuard(respond(404), "JeromeJobCollector");
    expect(await guard.isAllowed("https://example.com/anything")).toBe(true);
  });

  it("fails closed when robots.txt cannot be verified (5xx or network error)", async () => {
    expect(await createRobotsGuard(respond(503), "JeromeJobCollector").isAllowed("https://example.com/x")).toBe(false);
    const broken = createRobotsGuard(async () => { throw new Error("ECONNRESET"); }, "JeromeJobCollector");
    expect(await broken.isAllowed("https://example.com/x")).toBe(false);
  });

  it("rejects non-http(s) and malformed URLs", async () => {
    const guard = createRobotsGuard(respond(200, ""), "JeromeJobCollector");
    expect(await guard.isAllowed("file:///etc/passwd")).toBe(false);
    expect(await guard.isAllowed("javascript:alert(1)")).toBe(false);
    expect(await guard.isAllowed("nope")).toBe(false);
  });

  it("fetches robots.txt once per origin even for concurrent checks", async () => {
    let calls = 0;
    const guard = createRobotsGuard(async () => { calls++; return { status: 200, text: async () => "User-agent: *\nDisallow: /a\n" }; }, "JeromeJobCollector");
    await Promise.all([guard.isAllowed("https://example.com/1"), guard.isAllowed("https://example.com/2"), guard.isAllowed("https://example.com/a")]);
    await guard.isAllowed("https://example.com/3");
    expect(calls).toBe(1);
    await guard.isAllowed("https://other.example.com/1");
    expect(calls).toBe(2);
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { APIResponse } from "@playwright/test";
import { SkipEnrichmentError } from "@scripts/jobs/concurrency";
import { HostThrottle, RobotsDisallowedError, createPoliteRequest, resolveRedirectTarget, withDeadline } from "@scripts/jobs/http";
import { MIN_HOST_INTERVAL_MS, USER_AGENT, isRobotsExempt, sourcePolicies } from "@scripts/jobs/policy";
import type { RobotsGuard } from "@scripts/jobs/robots";

const allowAll: RobotsGuard = { isAllowed: async () => true };
const denyAll: RobotsGuard = { isAllowed: async () => false };
const deny = (prefix: string): RobotsGuard => ({ isAllowed: async (url) => !url.startsWith(prefix) });
const response = (status: number, headers: Record<string, string> = {}) => ({ status: () => status, headers: () => headers }) as unknown as APIResponse;

describe("HostThrottle", () => {
  it("spaces requests to the same host and leaves other hosts alone", async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const throttle = new HostThrottle(1000, () => clock, async (ms) => { sleeps.push(ms); clock += ms; });
    await throttle.wait("a.example");
    await throttle.wait("a.example");
    await throttle.wait("a.example");
    await throttle.wait("b.example");
    expect(sleeps).toEqual([1000, 1000]);
  });

  it("queues concurrent callers instead of releasing them together", async () => {
    const clock = 0;
    const sleeps: number[] = [];
    const throttle = new HostThrottle(500, () => clock, async (ms) => { sleeps.push(ms); });
    await Promise.all([throttle.wait("a"), throttle.wait("a"), throttle.wait("a")]);
    expect(sleeps).toEqual([500, 1000]);
  });
});

describe("createPoliteRequest", () => {
  const throttle = () => new HostThrottle(0);

  it("identifies itself and bounds the request time", async () => {
    const get = vi.fn(async () => response(200));
    const request = createPoliteRequest({ request: { get } as never, guard: allowAll, throttle: throttle(), source: "larajobs" });
    await request.get("https://larajobs.com/feed", { headers: { Accept: "application/rss+xml" } });
    expect(get).toHaveBeenCalledWith("https://larajobs.com/feed", expect.objectContaining({ headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml" }, timeout: expect.any(Number) }));
  });

  it("refuses, without making the request, when robots.txt disallows", async () => {
    const get = vi.fn();
    const request = createPoliteRequest({ request: { get } as never, guard: denyAll, throttle: throttle(), source: "weworkremotely" });
    await expect(request.get("https://weworkremotely.com/x")).rejects.toThrow(RobotsDisallowedError);
    expect(get).not.toHaveBeenCalled();
  });

  it("honours a documented exemption only for the exact published endpoint", async () => {
    const get = vi.fn(async () => response(200));
    const request = createPoliteRequest({ request: { get } as never, guard: denyAll, throttle: throttle(), source: "remotive" });
    await request.get("https://remotive.com/api/remote-jobs?category=software-dev");
    expect(get).toHaveBeenCalledTimes(1);
    await expect(request.get("https://remotive.com/api/other-endpoint")).rejects.toThrow(RobotsDisallowedError);
  });
});

describe("resolveRedirectTarget", () => {
  const throttle = new HostThrottle(0);
  const chain = (map: Record<string, APIResponse>) => ({ head: vi.fn(async (url: string) => map[url] ?? response(200)) }) as never;

  it("follows a redirect chain hop by hop to the final URL", async () => {
    const request = chain({
      "https://larajobs.com/job/1": response(302, { location: "https://tracker.example/r?x=1" }),
      "https://tracker.example/r?x=1": response(301, { location: "/careers/1" })
    });
    expect(await resolveRedirectTarget("https://larajobs.com/job/1", { request, guard: allowAll, throttle })).toBe("https://tracker.example/careers/1");
  });

  it("checks robots.txt BEFORE requesting each hop and never touches a disallowed host", async () => {
    const request = chain({ "https://larajobs.com/job/1": response(302, { location: "https://blocked.example/jobs/1" }) });
    await expect(resolveRedirectTarget("https://larajobs.com/job/1", { request, guard: deny("https://blocked.example"), throttle })).rejects.toThrow(SkipEnrichmentError);
    const heads = (request as { head: ReturnType<typeof vi.fn> }).head.mock.calls.map((call) => call[0]);
    expect(heads).toEqual(["https://larajobs.com/job/1"]);
  });

  it("gives up on redirect loops and on network errors, as a skip rather than a failure", async () => {
    const loop = chain({ "https://a.example/": response(302, { location: "https://a.example/" }) });
    await expect(resolveRedirectTarget("https://a.example/", { request: loop, guard: allowAll, throttle })).rejects.toThrow(/too many redirects/);
    const broken = { head: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) } as never;
    await expect(resolveRedirectTarget("https://a.example/", { request: broken, guard: allowAll, throttle })).rejects.toThrow(SkipEnrichmentError);
  });
});

describe("withDeadline", () => {
  it("passes through results and errors, and cancels its timer", async () => {
    expect(await withDeadline("x", 1000, async () => 42)).toBe(42);
    await expect(withDeadline("x", 1000, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });

  it("rejects a hung task at the deadline", async () => {
    await expect(withDeadline("Slow source", 20, () => new Promise(() => {}))).rejects.toThrow(/Slow source exceeded its 0s deadline|Slow source exceeded/);
  });
});

describe("source policy", () => {
  it("declares a policy for every source, and defaults to obeying robots.txt", () => {
    const sources = ["larajobs", "laravel-news", "remotive", "weworkremotely"] as const;
    for (const source of sources) {
      expect(sourcePolicies[source].constraints.length).toBeGreaterThan(20);
      expect(["api", "rss", "structured-html"]).toContain(sourcePolicies[source].method);
    }
    expect(sourcePolicies.larajobs.robotsExemptions).toEqual([]);
    expect(sourcePolicies.weworkremotely.robotsExemptions).toEqual([]);
  });

  it("scopes the only exemption to Remotive's published API and requires a justification", () => {
    const exemptions = Object.values(sourcePolicies).flatMap((policy) => policy.robotsExemptions);
    expect(exemptions).toHaveLength(1);
    expect(exemptions[0].justification.length).toBeGreaterThan(40);
    expect(isRobotsExempt("remotive", "https://remotive.com/api/remote-jobs?category=software-dev")).toBe(true);
    expect(isRobotsExempt("remotive", "https://remotive.com/jobs/anything")).toBe(false);
    expect(isRobotsExempt("larajobs", "https://remotive.com/api/remote-jobs")).toBe(false);
  });

  it("keeps request spacing polite", () => {
    expect(MIN_HOST_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
  });
});

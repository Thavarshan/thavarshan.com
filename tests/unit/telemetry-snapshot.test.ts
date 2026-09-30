// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateKey, type WireEvent } from "@/features/telemetry/events";
import { buildSnapshot, daysBetween, isoWeekLabel, lastCompletedWeek, renderSnapshotSummary, snapshotSchema, type AggregateRow } from "@/features/telemetry/snapshot";
import { MAX_KEYS, main, parseArgs, periodFor, readRowsFromKv } from "@scripts/growth/metrics-snapshot";

const period = { start: "2026-09-21", end: "2026-09-27", isoWeek: "2026-W39" };
const row = (overrides: Partial<AggregateRow> = {}): AggregateRow => ({ day: "2026-09-22", event: "repo_click", path: "/projects/fetch-php", source: null, medium: null, campaign: null, referrer: "direct", props: { project: "fetch-php" }, count: 1, ...overrides });
const build = (rows: AggregateRow[], previous = null as ReturnType<typeof buildSnapshot> | null) => buildSnapshot(rows, period, "2026-09-28T04:30:00.000Z", previous);

describe("ISO weeks", () => {
  it("computes ISO week labels, including year boundaries", () => {
    expect(isoWeekLabel(new Date("2026-09-21T00:00:00Z"))).toBe("2026-W39");
    expect(isoWeekLabel(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekLabel(new Date("2021-01-03T00:00:00Z"))).toBe("2020-W53");
    expect(isoWeekLabel(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
  });

  it("picks the last COMPLETED Monday-Sunday week, whatever day it runs", () => {
    for (const day of ["2026-09-28", "2026-09-29", "2026-10-04"]) expect(lastCompletedWeek(new Date(`${day}T04:30:00Z`))).toEqual({ start: "2026-09-21", end: "2026-09-27", isoWeek: "2026-W39" });
    expect(lastCompletedWeek(new Date("2026-10-05T00:00:01Z")).start).toBe("2026-09-28");
    expect(daysBetween("2026-09-21", "2026-09-27")).toHaveLength(7);
  });
});

describe("buildSnapshot", () => {
  const rows: AggregateRow[] = [
    row({ count: 4, source: "linkedin", medium: "social", campaign: "release-x", referrer: "social" }),
    row({ event: "demo_click", count: 2, referrer: "search" }),
    row({ event: "cv_download", path: "/", props: { location: "home" }, count: 3 }),
    row({ event: "tool_completed", path: "/tools/laravel-env-checker", props: { tool: "laravel-env-checker" }, count: 5, source: "devto", medium: "referral", campaign: "tool-post", referrer: "community" }),
    row({ event: "insight_read", path: "/insights/a", props: { slug: "a" }, count: 7, referrer: "direct" }),
    row({ event: "profile_click", path: "/", props: { network: "github" }, count: 1, referrer: "internal" }),
    row({ day: "2026-09-10", count: 99 }) // outside the period
  ];

  it("totals actions by stage and event, ignoring days outside the period", () => {
    const snapshot = build(rows);
    expect(snapshot.totals.byEvent).toMatchObject({ repo_click: 4, demo_click: 2, cv_download: 3, tool_completed: 5, insight_read: 7, profile_click: 1, contact_cta: 0 });
    expect(snapshot.totals.byStage).toEqual({ engagement: 8, intent: 14 });
    expect(snapshot.coverage).toMatchObject({ events: 22, rows: 6, daysWithData: 1, daysInPeriod: 7 });
  });

  it("separates attributed from UNKNOWN attribution and never assigns the unknown to a channel", () => {
    const snapshot = build(rows);
    expect(snapshot.acquisition.attributed).toBe(11);
    expect(snapshot.acquisition.unattributed).toBe(11);
    expect(snapshot.acquisition.unattributedShare).toBe(0.5);
    expect(snapshot.acquisition.byReferrer).toMatchObject({ social: 4, search: 2, direct: 10, community: 5, internal: 1 });
    expect(snapshot.notes.join(" ")).toMatch(/50% of counted actions have no campaign or referrer signal/);
  });

  it("ranks campaigns by intent, and breaks intent down by project, tool and location", () => {
    const snapshot = build(rows);
    expect(snapshot.acquisition.byCampaign.map((entry) => `${entry.campaign}:${entry.intentEvents}`)).toEqual(["tool-post:5", "release-x:4"]);
    expect(snapshot.intent.byProject["fetch-php"]).toEqual({ repo_click: 4, demo_click: 2 });
    expect(snapshot.intent.byTool["laravel-env-checker"]).toEqual({ tool_completed: 5 });
    expect(snapshot.intent.byLocation).toEqual({ home: 3 });
    expect(snapshot.content.topPaths[0]).toMatchObject({ path: "/projects/fetch-php", intentEvents: 6 });
    expect(snapshot.content.insightsRead).toEqual([{ slug: "a", reads: 7 }]);
  });

  it("is honest that rates cannot be computed and every number is a lower bound", () => {
    const notes = build(rows).notes.join("\n");
    expect(notes).toMatch(/lower bound/);
    expect(notes).toMatch(/Do Not Track/);
    expect(notes).toMatch(/conversion RATES cannot be computed/);
    expect(notes).toMatch(/Only 1 of 7 days/);
  });

  it("compares with the previous week", () => {
    const previous = buildSnapshot([row({ day: "2026-09-15", count: 1 })], { start: "2026-09-14", end: "2026-09-20", isoWeek: "2026-W38" }, "2026-09-21T00:00:00.000Z", null);
    const snapshot = build(rows, previous);
    expect(snapshot.comparison.previousIsoWeek).toBe("2026-W38");
    expect(snapshot.comparison.byEvent.repo_click).toEqual({ previous: 1, current: 4, delta: 3 });
    expect(snapshot.comparison.byEvent.demo_click).toEqual({ previous: 0, current: 2, delta: 2 });
  });

  it("handles an empty week without dividing by zero", () => {
    const snapshot = build([]);
    expect(snapshot.acquisition.unattributedShare).toBe(0);
    expect(snapshot.notes.join(" ")).toContain("No events were recorded");
    expect(snapshot.comparison.byEvent).toEqual({});
  });

  it("is deterministic and always matches its schema", () => {
    expect(build(rows)).toEqual(build([...rows].reverse()));
    expect(snapshotSchema.safeParse(build(rows)).success).toBe(true);
    expect(snapshotSchema.safeParse(build([])).success).toBe(true);
  });

  it("renders a readable summary with the caveats", () => {
    const text = renderSnapshotSummary(build(rows));
    expect(text).toContain("## Growth metrics 2026-W39");
    expect(text).toContain("`repo_click`");
    expect(text).toContain("unattributed: 11 (50%)");
    expect(text).toContain("Read this carefully");
  });
});

describe("CLI helpers", () => {
  it("validates arguments", () => {
    expect(parseArgs(["--dry-run"])).toMatchObject({ dryRun: true });
    expect(parseArgs(["--start", "2026-09-01", "--end", "2026-09-07"])).toMatchObject({ start: "2026-09-01", end: "2026-09-07" });
    expect(() => parseArgs(["--start", "2026-09-01"])).toThrow(/together/);
    expect(() => parseArgs(["--start", "yesterday", "--end", "2026-09-07"])).toThrow(/YYYY-MM-DD/);
    expect(() => parseArgs(["--start", "2026-09-09", "--end", "2026-09-07"])).toThrow(/after/);
  });

  it("defaults to the last completed week", () => {
    expect(periodFor(parseArgs([]), new Date("2026-09-29T00:00:00Z")).isoWeek).toBe("2026-W39");
  });

  it("skips cleanly, writing nothing, when credentials are absent", async () => {
    const saved = { ...process.env };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(main(["--dry-run"])).resolves.toBeUndefined();
    expect(log.mock.calls.join(" ")).toContain("skipping the metrics snapshot");
    log.mockRestore();
    process.env = saved;
  });
});

describe("readRowsFromKv", () => {
  afterEach(() => vi.unstubAllGlobals());
  const event: WireEvent = { event: "repo_click", path: "/projects/fetch-php", source: "linkedin", medium: "social", campaign: "c1", referrer: "social", props: { project: "fetch-php" } };
  const good = aggregateKey("2026-09-22", event);
  const credentials = { token: "TOKEN-SENTINEL", accountId: "a".repeat(32) };

  function stub(handler: (url: string) => Response) {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => { calls.push(input); return handler(input); }));
    return calls;
  }

  it("lists each day with pagination, reads values, and ignores forged keys and absurd counts", async () => {
    const pages: Record<string, string[]> = { "": [good, "m|2026-09-22|forged|/|-|-|-|direct|-"], next: ["m|2026-09-22|cv_download|/cv|-|-|-|direct|location=cv", "m|2026-09-22|cv_download|/cv|-|-|-|direct|location=home"] };
    const values: Record<string, string> = { [good]: "4", "m|2026-09-22|cv_download|/cv|-|-|-|direct|location=cv": "2000000", "m|2026-09-22|cv_download|/cv|-|-|-|direct|location=home": "not-a-number" };
    stub((url) => {
      if (url.includes("/keys?")) {
        const params = new URL(url).searchParams;
        if (!params.get("prefix")!.startsWith("m|2026-09-22|")) return Response.json({ result: [], result_info: {} });
        const cursor = params.get("cursor") ?? "";
        return Response.json({ result: (pages[cursor] ?? []).map((name) => ({ name })), result_info: cursor === "" ? { cursor: "next" } : {} });
      }
      const key = decodeURIComponent(url.split("/values/")[1]);
      return key in values ? new Response(values[key]) : new Response("", { status: 404 });
    });
    const rows = await readRowsFromKv(period, credentials);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "repo_click", campaign: "c1", count: 4, day: "2026-09-22" });
  });

  it("refuses to read an unbounded number of keys (abuse protection)", async () => {
    const many = Array.from({ length: MAX_KEYS + 1 }, (_, i) => ({ name: `m|2026-09-22|repo_click|/p${i}|-|-|-|direct|project=x` }));
    stub(() => Response.json({ result: many, result_info: {} }));
    await expect(readRowsFromKv(period, credentials)).rejects.toThrow(/Refusing to read more than/);
  });

  it("surfaces API failures without leaking the token or ids", async () => {
    stub(() => new Response("nope", { status: 403 }));
    let message = "";
    await readRowsFromKv(period, credentials).catch((caught: Error) => { message = caught.message; });
    expect(message).toMatch(/Cloudflare API 403/);
    expect(message).not.toContain("TOKEN-SENTINEL");
    expect(message).not.toContain(credentials.accountId);
  });
});

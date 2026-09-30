import { describe, expect, it } from "vitest";
import { COLLECTOR_VERSION, type OpportunitySnapshot, type SourceStats } from "@/lib/job-opportunities";
import { HEARTBEAT_HOURS, assessRunHealth, isMaterialChange, renderRunSummary, summarizeError } from "@scripts/jobs/health";

const now = "2026-09-30T12:00:00.000Z";
const quiet: SourceStats = { added: 0, updated: 0, unchanged: 5, closed: 0, pruned: 0, held: 0 };
const source = (name: string, status: "ok" | "failed" = "ok", durationMs: number | null = 1200) => ({
  name, url: "https://example.com", collectedAt: now, status, durationMs, recordsFound: 5, added: 0, updated: 0, closed: 0, held: 0, skipped: 0, rejected: 0, error: status === "failed" ? "boom" : null
});
const previous = (overrides: Partial<OpportunitySnapshot> = {}): OpportunitySnapshot => ({
  schemaVersion: 2, generatedAt: "2026-09-30T02:00:00.000Z", collectorVersion: COLLECTOR_VERSION,
  candidate: { location: "Sri Lanka", preferredStack: [], experienceYears: 11, workModes: ["remote"] },
  sources: [source("A"), source("B")], opportunities: [], ...overrides
});

describe("assessRunHealth", () => {
  it("distinguishes healthy, degraded and all-failed runs", () => {
    const ok = { source: "larajobs" as const, opportunities: [], skipped: 0, rejected: 0 };
    const bad = { source: "remotive" as const, failed: true as const, error: "timeout" };
    expect(assessRunHealth([ok, ok])).toMatchObject({ degraded: false, allFailed: false });
    expect(assessRunHealth([ok, bad])).toMatchObject({ degraded: true, allFailed: false, failedSources: [{ source: "remotive", error: "timeout" }] });
    expect(assessRunHealth([bad, bad])).toMatchObject({ degraded: true, allFailed: true });
  });
});

describe("isMaterialChange (no-op commit avoidance)", () => {
  const args = (overrides: Record<string, unknown> = {}) => ({
    previous: previous(), stats: { larajobs: quiet }, nextSources: [source("A"), source("B")], now, ...overrides
  });

  it("treats an unchanged day as not material", () => {
    expect(isMaterialChange(args())).toEqual({ material: false, reason: "no material changes" });
  });

  it("is material on any added/updated/closed/pruned/held listing", () => {
    for (const key of ["added", "updated", "closed", "pruned", "held"] as const) {
      expect(isMaterialChange(args({ stats: { larajobs: { ...quiet, [key]: 1 } } })).material, key).toBe(true);
    }
  });

  it("is material on first run, a collector version change, or a source health change", () => {
    expect(isMaterialChange(args({ previous: null })).material).toBe(true);
    expect(isMaterialChange(args({ previous: previous({ collectorVersion: "0.0.1" }) })).material).toBe(true);
    expect(isMaterialChange(args({ previous: previous({ collectorVersion: null }) })).material).toBe(true);
    expect(isMaterialChange(args({ nextSources: [source("A"), source("B", "failed")] })).material).toBe(true);
  });

  it("writes a heartbeat once the snapshot is old, so lastSeenAt never goes stale", () => {
    const old = new Date(new Date(now).getTime() - (HEARTBEAT_HOURS + 1) * 3_600_000).toISOString();
    expect(isMaterialChange(args({ previous: previous({ generatedAt: old }) }))).toMatchObject({ material: true });
    const recent = new Date(new Date(now).getTime() - (HEARTBEAT_HOURS - 1) * 3_600_000).toISOString();
    expect(isMaterialChange(args({ previous: previous({ generatedAt: recent }) })).material).toBe(false);
  });
});

describe("renderRunSummary", () => {
  const sources = [source("LaraJobs RSS", "ok", 15400), source("Remotive", "failed", 320), source("Old", "ok", null)];

  it("reports per-source duration, health headline and failures", () => {
    const text = renderRunSummary({
      sources, opportunities: [], written: true, reason: "larajobs changed",
      health: { failedSources: [{ source: "remotive", error: "robots.txt does not permit fetching x" }], allFailed: false, degraded: true }
    });
    expect(text).toContain("Degraded — 1 of 3 sources failed");
    expect(text).toContain("**remotive**: robots.txt does not permit fetching x");
    expect(text).toContain("| Duration |");
    expect(text).toContain("15.4s");
    expect(text).toContain("320ms");
    expect(text).toContain("n/a");
    expect(text).toContain("written (larajobs changed)");
  });

  it("states when nothing was rewritten and when everything is healthy", () => {
    const healthy = { failedSources: [], allFailed: false, degraded: false };
    const text = renderRunSummary({ sources: [source("A")], opportunities: [], health: healthy, written: false, reason: "no material changes" });
    expect(text).toContain("All sources healthy");
    expect(text).toContain("not rewritten (no material changes)");
    const dead = renderRunSummary({ sources, opportunities: [], written: false, reason: "every source failed", health: { failedSources: [], allFailed: true, degraded: true } });
    expect(dead).toContain("All sources failed — snapshot left untouched");
  });
});

describe("summarizeError", () => {
  it("reduces Playwright's coloured multi-line errors to one clean line", () => {
    const raw = new Error("apiRequestContext.get: getaddrinfo EAI_AGAIN remotive.com\nCall log:\n\u001b[2m  - → GET https://remotive.com/api\u001b[22m\n    - user-agent: x");
    expect(summarizeError(raw)).toBe("apiRequestContext.get: getaddrinfo EAI_AGAIN remotive.com");
  });

  it("handles non-errors, empty messages and very long lines", () => {
    expect(summarizeError("plain string")).toBe("plain string");
    expect(summarizeError(new Error(""))).toBe("unknown error");
    expect(summarizeError(new Error("x".repeat(500))).length).toBe(240);
    expect(summarizeError(new Error("x".repeat(500)))).toMatch(/…$/);
  });
});

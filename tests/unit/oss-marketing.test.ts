// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { GitHubProject } from "@/lib/github-model";
import {
  DEFAULT_COOLDOWN_DAYS,
  STAR_MILESTONES,
  buildBundle,
  bundleDirectoryName,
  clean,
  detectEvents,
  emptyLedger,
  findUnverifiedNumbers,
  ledgerSchema,
  parseSemver,
  type Ledger,
  type Snapshots
} from "@/lib/oss-marketing";
import { parseArgs, renderSummary } from "@/scripts/marketing/oss-bundles";

const NOW = new Date("2026-10-01T00:00:00.000Z");
const SYNCED = "2026-09-29T00:00:00.000Z";

function project(repository: string, stars: number, overrides: Partial<GitHubProject> = {}): GitHubProject {
  return {
    repository, name: repository.replace(/^./, (c) => c.toUpperCase()), description: "A tidy PHP library.", topics: ["php", "http-client"],
    primaryLanguage: "PHP", stars, forks: 3, homepage: null, repositoryUrl: `https://github.com/Thavarshan/${repository}`,
    updatedAt: SYNCED, readmeExcerpt: [], ...overrides
  } as GitHubProject;
}

function snapshots(options: { stars?: number; downloads?: number; dependents?: number; version?: string; repos?: Array<[string, number]>; synced?: string } = {}): Snapshots {
  const synced = options.synced ?? SYNCED;
  const repos = options.repos ?? [["alpha", options.stars ?? 40]];
  return {
    github: { syncedAt: synced, projects: repos.map(([name, stars]) => project(name, stars)) },
    registry: {
      syncedAt: synced,
      packages: repos.map(([name]) => ({ provider: "packagist" as const, packageName: `jerome/${name}`, repository: name, downloads: options.downloads ?? 500, dependents: options.dependents ?? 1, latestVersion: options.version ?? "1.2.0", updatedAt: "2026-09-20T00:00:00.000Z" }))
    }
  };
}

const run = (snap: Snapshots, ledger: Ledger | null, extra: Parameters<typeof detectEvents>[2] extends infer O ? Partial<O> : never = {}) => detectEvents(snap, ledger, { now: NOW, ...extra });
const outcomes = (result: ReturnType<typeof detectEvents>) => result.decisions.map((decision) => `${decision.outcome}:${decision.eventId}`);

describe("parseSemver", () => {
  it("parses stable, v-prefixed, two-part and pre-release versions; rejects junk", () => {
    expect(parseSemver("3.8.1")).toEqual({ major: 3, minor: 8, patch: 1, prerelease: false });
    expect(parseSemver("v2.0")).toEqual({ major: 2, minor: 0, patch: 0, prerelease: false });
    expect(parseSemver("4.0.0-beta.1")).toMatchObject({ prerelease: true });
    expect(parseSemver("1.2.3+build5")).toMatchObject({ prerelease: false });
    for (const junk of ["", "latest", "1", "a.b.c", "1.2.3.4", "dev-main"]) expect(parseSemver(junk), junk).toBeNull();
  });
});

describe("first run: baseline, never a flood of announcements", () => {
  it("records what is already true without drafting anything", () => {
    const result = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), null);
    expect(result.decisions.every((decision) => decision.outcome === "baseline")).toBe(true);
    expect(result.nextLedger.entries["stars-milestone:alpha:250"]).toMatchObject({ outcome: "baseline" });
    expect(result.nextLedger.entries["downloads-milestone:alpha:10000"]).toMatchObject({ outcome: "baseline" });
    expect(result.nextLedger.lastSeenVersion["jerome/alpha"]).toBe("3.8.1");
    expect(ledgerSchema.safeParse(result.nextLedger).success).toBe(true);
  });

  it("--backfill drafts only the single highest milestone per metric on a first run", () => {
    const result = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), null, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    const generated = result.decisions.filter((decision) => decision.outcome === "generate").map((decision) => decision.eventId);
    expect(generated).toContain("downloads-milestone:alpha:10000");
    expect(generated).not.toContain("downloads-milestone:alpha:5000");
    expect(generated).not.toContain("downloads-milestone:alpha:1000");
  });

  it("--backfill announces the current release only when it is a stable x.y.0", () => {
    const stable = run(snapshots({ version: "3.8.0" }), null, { backfill: true, maxPerRun: 10 });
    expect(stable.decisions.some((decision) => decision.outcome === "generate" && decision.eventId === "release:alpha:3.8.0")).toBe(true);
    for (const version of ["3.8.1", "4.0.0-beta.1"]) {
      const other = run(snapshots({ version }), null, { backfill: true, maxPerRun: 10 });
      expect(other.decisions.some((decision) => decision.eventId.startsWith("release:") && decision.outcome === "generate"), version).toBe(false);
    }
  });
});

describe("--backfill after the baseline exists (manual preview)", () => {
  const ledger = () => run(snapshots({ stars: 451, downloads: 10938, version: "3.8.0" }), null).nextLedger;

  it("does nothing without --backfill", () => {
    expect(run(snapshots({ stars: 451, downloads: 10938, version: "3.8.0" }), ledger()).decisions).toEqual([]);
  });

  it("drafts the current stable x.y.0 release first, holding the project's other events (one bundle per project per run)", () => {
    const result = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.0" }), ledger(), { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    const generated = result.decisions.filter((decision) => decision.outcome === "generate").map((decision) => decision.eventId);
    expect(generated).toEqual(["release:alpha:3.8.0"]);
    const held = result.decisions.filter((decision) => decision.outcome === "defer").map((decision) => decision.eventId);
    expect(held).toEqual(expect.arrayContaining(["downloads-milestone:alpha:10000", "stars-milestone:alpha:250"]));
  });

  it("drafts only the highest baselined milestone per metric", () => {
    const base = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), null).nextLedger;
    const result = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), base, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    const ids = result.decisions.map((decision) => decision.eventId);
    expect(result.decisions.find((decision) => decision.eventId === "downloads-milestone:alpha:10000")?.outcome).toBe("generate");
    for (const lower of ["downloads-milestone:alpha:5000", "downloads-milestone:alpha:1000", "stars-milestone:alpha:100", "stars-milestone:alpha:50"]) expect(ids, lower).not.toContain(lower);
  });

  it("marks backfilled events as generated so they are never drafted twice", () => {
    const base = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), null).nextLedger;
    const first = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), base, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    expect(first.nextLedger.entries["downloads-milestone:alpha:10000"].outcome).toBe("generated");
    const second = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.1" }), first.nextLedger, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    expect(second.decisions.filter((decision) => decision.outcome === "generate").map((decision) => decision.eventId)).not.toContain("downloads-milestone:alpha:10000");

    const releaseBase = ledger();
    const release = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.0" }), releaseBase, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    expect(release.nextLedger.entries["release:alpha:3.8.0"]?.outcome).toBe("generated");
    const again = run(snapshots({ stars: 451, downloads: 10938, version: "3.8.0" }), release.nextLedger, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
    expect(again.decisions.filter((decision) => decision.outcome === "generate").map((decision) => decision.eventId)).not.toContain("release:alpha:3.8.0");
  });

  it("skips patch releases and pre-releases even when backfilling", () => {
    for (const version of ["3.8.1", "4.0.0-beta.1"]) {
      const base = run(snapshots({ version }), null).nextLedger;
      const result = run(snapshots({ version }), base, { backfill: true, maxPerRun: 10, cooldownDays: 0 });
      expect(result.decisions.some((decision) => decision.eventId.startsWith("release:") && decision.outcome === "generate"), version).toBe(false);
    }
  });
});

describe("milestones", () => {
  const baseline = () => run(snapshots({ stars: 451 }), null).nextLedger;

  it("drafts a bundle when a milestone is newly crossed, then never again", () => {
    const crossed = run(snapshots({ stars: 503 }), baseline());
    expect(outcomes(crossed)).toEqual(["generate:stars-milestone:alpha:500"]);
    expect(crossed.decisions[0].event?.evidence.map((item) => item.value)).toEqual([503, 500]);

    const again = run(snapshots({ stars: 503 }), crossed.nextLedger);
    expect(again.decisions).toEqual([]);
    const later = run(snapshots({ stars: 520 }), crossed.nextLedger);
    expect(later.decisions).toEqual([]);
  });

  it("announces only the highest of several milestones crossed at once", () => {
    const result = run(snapshots({ stars: 1200 }), baseline());
    expect(outcomes(result)).toEqual(expect.arrayContaining(["generate:stars-milestone:alpha:1000", "superseded:stars-milestone:alpha:500"]));
    expect(result.decisions.filter((decision) => decision.outcome === "generate")).toHaveLength(1);
  });

  it("does nothing when no new milestone is crossed", () => {
    expect(run(snapshots({ stars: 460 }), baseline()).decisions).toEqual([]);
  });

  it("covers downloads and dependents with their own thresholds", () => {
    const start = run(snapshots({ stars: 40, downloads: 900, dependents: 2 }), null).nextLedger;
    const result = run(snapshots({ stars: 40, downloads: 1400, dependents: 6 }), start, { cooldownDays: 0, maxPerRun: 5 });
    expect(outcomes(result)).toEqual(expect.arrayContaining(["generate:downloads-milestone:alpha:1000"]));
    expect(outcomes(result).join()).toContain("dependents-milestone:alpha:5");
  });

  it("uses a sane, ascending threshold table", () => {
    expect([...STAR_MILESTONES]).toEqual([...STAR_MILESTONES].sort((a, b) => a - b));
  });
});

describe("releases: the meaningful-change threshold", () => {
  const start = () => run(snapshots({ version: "3.8.1" }), null).nextLedger;
  const withVersion = (version: string) => run(snapshots({ version }), start());

  it("ignores patch releases but remembers them", () => {
    const result = withVersion("3.8.2");
    expect(result.decisions).toMatchObject([{ outcome: "skip" }]);
    expect(result.decisions[0].reason).toMatch(/patch release/);
    expect(result.nextLedger.lastSeenVersion["jerome/alpha"]).toBe("3.8.2");
    expect(run(snapshots({ version: "3.8.2" }), result.nextLedger).decisions).toEqual([]);
  });

  it("drafts for a new minor or major release", () => {
    expect(outcomes(withVersion("3.9.0"))).toEqual(["generate:release:alpha:3.9.0"]);
    expect(outcomes(withVersion("4.0.0"))).toEqual(["generate:release:alpha:4.0.0"]);
  });

  it("a patch after an announced minor is still not announced", () => {
    const minor = withVersion("3.9.0");
    const patch = run(snapshots({ version: "3.9.1" }), minor.nextLedger, { cooldownDays: 0 });
    expect(patch.decisions).toMatchObject([{ outcome: "skip" }]);
  });

  it("never announces pre-releases, unrecognised versions or downgrades", () => {
    expect(withVersion("4.0.0-beta.1").decisions[0]).toMatchObject({ outcome: "skip" });
    expect(withVersion("4.0.0-beta.1").decisions[0].reason).toMatch(/pre-release/);
    expect(withVersion("nightly").decisions[0].reason).toMatch(/not recognised semver/);
    expect(withVersion("3.7.0").decisions[0].reason).toMatch(/not newer/);
  });

  it("carries the release date as evidence, from the registry", () => {
    const event = withVersion("3.9.0").decisions.find((d) => d.outcome === "generate")!.event!;
    expect(event.evidence.map((item) => item.value)).toEqual(["3.9.0", "2026-09-20"]);
    expect(event.evidence.every((item) => item.source === "data/package-registry.generated.json")).toBe(true);
  });
});

describe("rate limiting: no spam", () => {
  const repos: Array<[string, number]> = [["a", 99], ["b", 99], ["c", 99], ["d", 99]];
  const start = () => run(snapshots({ repos }), null).nextLedger;
  const bumped: Array<[string, number]> = repos.map(([name]) => [name, 120]);

  it("caps bundles per run and holds the rest for later without dropping them", () => {
    const result = run(snapshots({ repos: bumped }), start(), { maxPerRun: 2 });
    expect(result.decisions.filter((decision) => decision.outcome === "generate")).toHaveLength(2);
    const held = result.decisions.filter((decision) => decision.outcome === "defer");
    expect(held).toHaveLength(2);
    expect(held[0].reason).toMatch(/Per-run limit of 2/);
    for (const decision of held) expect(result.nextLedger.entries[decision.eventId]).toBeUndefined();

    const next = run(snapshots({ repos: bumped }), result.nextLedger, { maxPerRun: 2 });
    expect(next.decisions.filter((decision) => decision.outcome === "generate")).toHaveLength(2);
  });

  it("one bundle per project per run, and a cooldown between runs", () => {
    const ledger = run(snapshots({ stars: 99, downloads: 900, dependents: 0 }), null).nextLedger;
    const result = run(snapshots({ stars: 120, downloads: 1100, dependents: 0 }), ledger, { maxPerRun: 5 });
    expect(result.decisions.filter((decision) => decision.outcome === "generate")).toHaveLength(1);
    expect(result.decisions.find((decision) => decision.outcome === "defer")?.reason).toMatch(/already has a bundle this run/);

    const soon = run(snapshots({ stars: 120, downloads: 1100, dependents: 0, synced: "2026-10-04T00:00:00.000Z" }), result.nextLedger, { now: new Date("2026-10-05T00:00:00.000Z") });
    expect(soon.decisions.find((decision) => decision.outcome === "defer")?.reason).toMatch(new RegExp(`cooldown is ${DEFAULT_COOLDOWN_DAYS} days`));

    const later = run(snapshots({ stars: 120, downloads: 1100, dependents: 0, synced: "2026-10-19T00:00:00.000Z" }), result.nextLedger, { now: new Date("2026-10-20T00:00:00.000Z") });
    expect(later.decisions.filter((decision) => decision.outcome === "generate")).toHaveLength(1);
  });

  it("refuses to draft from stale snapshots and leaves the ledger untouched", () => {
    const ledger = start();
    const result = detectEvents(snapshots({ repos: bumped }), ledger, { now: new Date("2026-11-30T00:00:00.000Z") });
    expect(result.decisions).toEqual([]);
    expect(result.notes[0]).toMatch(/days old/);
    expect(result.nextLedger).toEqual(ledger);
  });

  it("ignores projects with unsafe repository names (they become directory and URL parts)", () => {
    const snap = snapshots({ repos: [["../../etc", 500], ["ok-repo", 500]] });
    const result = run(snap, emptyLedger());
    expect(result.decisions.every((decision) => !decision.eventId.includes(".."))).toBe(true);
    expect(result.notes.join(" ")).toMatch(/unsafe repository name/);
  });
});

describe("bundles", () => {
  const release = run(snapshots({ version: "3.8.1" }), null).nextLedger;
  const releaseEvent = run(snapshots({ version: "3.9.0" }), release).decisions.find((d) => d.outcome === "generate")!.event!;
  const milestoneEvent = run(snapshots({ stars: 130 }), run(snapshots({ stars: 40 }), null).nextLedger).decisions.find((d) => d.outcome === "generate")!.event!;
  const context = { siteUrl: "https://thavarshan.com", generatedAt: NOW.toISOString(), project: project("alpha", 130) };

  it("produces every artifact the issue lists, with UTM-ready links and evidence metadata", () => {
    const files = buildBundle(releaseEvent, context);
    expect(Object.keys(files).sort()).toEqual(["changelog.md", "community.md", "devto-outline.md", "linkedin.md", "metadata.json", "summary.md"]);
    const metadata = JSON.parse(files["metadata.json"]);
    expect(metadata).toMatchObject({ eventId: "release:alpha:3.9.0", autoPosted: false, generatorVersion: expect.any(String), canonicalUrl: "https://thavarshan.com/projects/alpha" });
    expect(metadata.trackedUrls.linkedin).toContain("utm_source=linkedin");
    expect(metadata.trackedUrls.reddit).toContain("utm_source=reddit&utm_medium=community");
    expect(metadata.trackedUrls.devto).toContain("utm_source=devto");
    expect(metadata.evidence.length).toBeGreaterThan(0);
    expect(files["summary.md"]).toContain("Nothing has been posted anywhere");
  });

  it("flags every spot a human must complete, and counts them", () => {
    const files = buildBundle(releaseEvent, context);
    const metadata = JSON.parse(files["metadata.json"]);
    expect(metadata.needsHumanInput).toBe(true);
    const counted = [files["linkedin.md"], files["devto-outline.md"], files["community.md"], files["changelog.md"]].join("\n").split("[WRITE:").length - 1;
    expect(metadata.placeholders).toBe(counted);
    expect(files["summary.md"]).toContain(`(${counted} in this bundle)`);
  });

  it("release community drafts lead with disclosure and usefulness; milestones get none", () => {
    const community = buildBundle(releaseEvent, context)["community.md"];
    expect(community).toContain("I am the author");
    expect(community).toMatch(/Read the community's self-promotion rules/);
    expect(community).toMatch(/Do not ask for upvotes or stars/);
    expect(buildBundle(milestoneEvent, context)["community.md"]).toMatch(/^Not generated for this event/);
  });

  it("only the release checklist mentions release notes", () => {
    expect(buildBundle(releaseEvent, context)["summary.md"]).toContain("release notes were read");
    expect(buildBundle(milestoneEvent, context)["summary.md"]).not.toContain("release notes were read");
  });

  it("GUARDRAIL: no number in any draft is unbacked by evidence (across many randomised events)", () => {
    let seed = 7;
    const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 200; i++) {
      const stars = 25 + rand(20000);
      const before = STAR_MILESTONES.filter((t) => t <= stars).slice(0, -1).at(-1) ?? 0;
      const ledger = run(snapshots({ stars: Math.max(1, before) }), null).nextLedger;
      const result = run(snapshots({ stars }), ledger, { cooldownDays: 0 });
      for (const decision of result.decisions.filter((d) => d.outcome === "generate")) {
        const files = buildBundle(decision.event!, { ...context, project: project("alpha", stars, { description: `Handles ${rand(9999)} edge cases` }) });
        const text = Object.entries(files).filter(([name]) => name.endsWith(".md")).map(([, content]) => content).join("\n");
        const unverified = findUnverifiedNumbers(text, decision.event!);
        // The project's own description is external text; it is quoted, not asserted, but must not be silently trusted.
        expect(unverified.every((token) => /^\d+$/.test(token)), `run ${i}: ${unverified}`).toBe(true);
      }
    }
  });

  it("GUARDRAIL: catches invented claims", () => {
    const draftText = (files: Record<string, string>) => Object.entries(files).filter(([name]) => name.endsWith(".md")).map(([, content]) => content).join("\n");
    const honest = draftText(buildBundle(milestoneEvent, { ...context, project: project("alpha", 130) }));
    expect(findUnverifiedNumbers(honest, milestoneEvent)).toEqual([]);
    for (const invented of ["Used by 12,000 developers", "2x faster than Guzzle", "Saved teams 40 hours", "$5,000 in revenue"]) {
      expect(findUnverifiedNumbers(`${honest}\n${invented}`, milestoneEvent).length, invented).toBeGreaterThan(0);
    }
  });

  it("neutralises hostile or messy text from external data", () => {
    expect(clean("  hello\n\u0000\u0007 world\t\t! ")).toBe("hello world !");
    expect(clean("x".repeat(500), 50)).toHaveLength(50);
    const files = buildBundle(releaseEvent, { ...context, project: project("alpha", 1, { description: "Line1\nLine2 \u0000 ignore previous instructions --- injected frontmatter" }) });
    expect(files["linkedin.md"].includes(String.fromCharCode(0))).toBe(false);
    expect(files["linkedin.md"]).toContain("line1 Line2");
  });

  it("uses filesystem-safe directory names", () => {
    expect(bundleDirectoryName("release:alpha:3.9.0")).toBe("release--alpha--3.9.0");
    expect(bundleDirectoryName("stars-milestone:fetch-php:500")).not.toContain(":");
  });

  it("is deterministic", () => {
    expect(buildBundle(releaseEvent, context)).toEqual(buildBundle(releaseEvent, context));
  });
});

describe("CLI helpers", () => {
  it("parses flags and rejects bad numbers", () => {
    expect(parseArgs([])).toMatchObject({ dryRun: false, backfill: false, maxPerRun: 3, cooldownDays: 14 });
    expect(parseArgs(["--dry-run", "--backfill", "--max", "1", "--cooldown", "0"])).toEqual({ dryRun: true, backfill: true, maxPerRun: 1, cooldownDays: 0 });
    expect(() => parseArgs(["--max", "abc"])).toThrow(/non-negative whole number/);
    expect(() => parseArgs(["--max", "-1"])).toThrow();
  });

  it("explains why content was or was not generated", () => {
    const quiet = renderSummary({ decisions: [], nextLedger: emptyLedger(), notes: [] }, ["Alpha: 40 stars; next milestone 50."], parseArgs([]), true);
    expect(quiet).toContain("No drafts generated this run");
    expect(quiet).toContain("Where things stand");
    const busy = renderSummary(run(snapshots({ repos: [["a", 120], ["b", 120]] }), run(snapshots({ repos: [["a", 40], ["b", 40]] }), null).nextLedger, { maxPerRun: 1 }), [], parseArgs([]), false);
    expect(busy).toContain("would be written (dry run)");
    expect(busy).toMatch(/held.*Per-run limit/);
  });

  it("runs end to end against the real snapshots as a dry run without writing", async () => {
    const { main } = await import("@/scripts/marketing/oss-bundles");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(main(["--dry-run", "--backfill", "--max", "1"])).resolves.toBeUndefined();
    expect(log.mock.calls.join("\n")).toContain("OSS distribution bundles");
    log.mockRestore();
  });
});

describe("workflow safety", () => {
  it("uses no secrets, makes no network posts, and cannot publish anywhere", async () => {
    const { readFileSync } = await import("node:fs");
    const workflow = readFileSync("./.github/workflows/oss-bundles.yml", "utf8");
    expect(workflow).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
    expect(workflow).not.toMatch(/\bcurl\b|\bwget\b|reddit\.com\/api|api\.linkedin|dev\.to\/api/i);
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("workflow_run");
    expect(workflow).toContain("automated-generated-content");
    expect(workflow).toContain("timeout-minutes");
  });

  it("the committed ledger is valid and records a baseline, so the first scheduled run drafts nothing stale", async () => {
    const { readFileSync } = await import("node:fs");
    const ledger = ledgerSchema.parse(JSON.parse(readFileSync("./marketing/oss-ledger.json", "utf8")));
    expect(Object.keys(ledger.entries).length).toBeGreaterThan(0);
    expect(Object.values(ledger.entries).every((entry) => entry.outcome === "baseline")).toBe(true);
    expect(Object.keys(ledger.lastSeenVersion).length).toBeGreaterThan(0);
  });
});

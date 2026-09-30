import { z } from "zod";
import { withUtm } from "../telemetry/analytics";
import type { GitHubProject } from "../projects/github-model";
import type { PackageRegistryStats } from "../projects/package-registry";

/**
 * Evidence-backed OSS promotion bundles (issue #46). Pure and deterministic: the same snapshots and
 * ledger always produce the same decisions and drafts, with no network, no AI and no cost.
 *
 * Guardrails enforced in code (and tests):
 *  - events come only from verifiable snapshot data (stars, downloads, dependents, released version);
 *  - a routine patch release or pre-release never produces marketing material;
 *  - every number in a draft must trace to recorded evidence (`findUnverifiedNumbers`);
 *  - the same event is never drafted twice (the ledger), and a project is rate-limited (cooldown);
 *  - nothing is posted anywhere: bundles are inspectable files for a human to review.
 */

export const GENERATOR_VERSION = "1.0.0";

export const STAR_MILESTONES = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
export const DOWNLOAD_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
export const DEPENDENT_MILESTONES = [5, 10, 25, 50, 100, 250, 500];

export const DEFAULT_MAX_PER_RUN = 3;
export const DEFAULT_COOLDOWN_DAYS = 14;
export const DEFAULT_MAX_SNAPSHOT_AGE_DAYS = 14;

// ---------------------------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------------------------

export const ledgerSchema = z.object({
  version: z.literal(1),
  /** Every event ever decided, so it is never drafted twice. */
  entries: z.record(z.string(), z.object({
    type: z.enum(["release", "stars-milestone", "downloads-milestone", "dependents-milestone"]),
    repository: z.string(),
    decidedAt: z.string().datetime(),
    outcome: z.enum(["generated", "baseline", "skipped", "superseded"])
  })),
  /** Last released version seen per package, to detect new releases. */
  lastSeenVersion: z.record(z.string(), z.string()),
  /** When a bundle was last generated per repository, for the cooldown. */
  lastGeneratedAt: z.record(z.string(), z.string().datetime())
});

export type Ledger = z.infer<typeof ledgerSchema>;
export type EventType = Ledger["entries"][string]["type"];

export const emptyLedger = (): Ledger => ({ version: 1, entries: {}, lastSeenVersion: {}, lastGeneratedAt: {} });

// ---------------------------------------------------------------------------------------------
// Events and evidence
// ---------------------------------------------------------------------------------------------

export interface Evidence {
  label: string;
  value: string | number;
  /** Repository file the value came from. */
  source: "data/github.generated.json" | "data/package-registry.generated.json";
  jsonPath: string;
  observedAt: string;
  url?: string;
}

export interface OssEvent {
  id: string;
  type: EventType;
  repository: string;
  projectName: string;
  headline: string;
  evidence: Evidence[];
  /** Milestone threshold or released version, for wording. */
  threshold?: number;
  version?: string;
}

export type Outcome = "generate" | "baseline" | "skip" | "defer" | "superseded";

export interface Decision {
  eventId: string;
  type: EventType;
  repository: string;
  outcome: Outcome;
  reason: string;
  event?: OssEvent;
}

export interface Snapshots {
  github: { syncedAt: string; projects: GitHubProject[] };
  registry: { syncedAt: string; packages: Array<PackageRegistryStats & { repository: string }> };
}

export interface DetectOptions {
  now: Date;
  maxPerRun?: number;
  cooldownDays?: number;
  maxSnapshotAgeDays?: number;
  /** Also draft the current best event per metric even on a first/baseline run (manual use). */
  backfill?: boolean;
}

export interface DetectResult {
  decisions: Decision[];
  nextLedger: Ledger;
  notes: string[];
}

const safeRepository = /^[A-Za-z0-9._-]{1,100}$/;

export function parseSemver(version: string): { major: number; minor: number; patch: number; prerelease: boolean } | null {
  const match = version.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?(?:(-[0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3] ?? 0), prerelease: Boolean(match[4]) };
}

function compareSemver(a: NonNullable<ReturnType<typeof parseSemver>>, b: NonNullable<ReturnType<typeof parseSemver>>) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function eventIdFor(type: EventType, repository: string, key: string | number) {
  return `${type}:${repository}:${key}`;
}

const metricConfig = {
  "stars-milestone": { thresholds: STAR_MILESTONES, noun: "GitHub stars" },
  "downloads-milestone": { thresholds: DOWNLOAD_MILESTONES, noun: "installs on Packagist" },
  "dependents-milestone": { thresholds: DEPENDENT_MILESTONES, noun: "dependent packages" }
} as const;

const priority: Record<EventType, number> = { release: 0, "downloads-milestone": 1, "stars-milestone": 2, "dependents-milestone": 3 };

function packagistUrl(item: { provider: string; packageName: string }) {
  if (item.provider === "packagist") return `https://packagist.org/packages/${item.packageName}`;
  if (item.provider === "npm") return `https://www.npmjs.com/package/${item.packageName}`;
  return `https://crates.io/crates/${item.packageName}`;
}

/** Decides which events qualify for a bundle this run, and what the ledger should record afterwards. */
export function detectEvents(snapshots: Snapshots, previous: Ledger | null, options: DetectOptions): DetectResult {
  const { now, maxPerRun = DEFAULT_MAX_PER_RUN, cooldownDays = DEFAULT_COOLDOWN_DAYS, maxSnapshotAgeDays = DEFAULT_MAX_SNAPSHOT_AGE_DAYS } = options;
  const baselineRun = previous === null;
  const ledger: Ledger = structuredClone(previous ?? emptyLedger());
  const decisions: Decision[] = [];
  const notes: string[] = [];
  const nowIso = now.toISOString();

  for (const [name, syncedAt] of [["GitHub snapshot", snapshots.github.syncedAt], ["package registry snapshot", snapshots.registry.syncedAt]] as const) {
    const ageDays = (now.getTime() - new Date(syncedAt).getTime()) / 86_400_000;
    if (ageDays > maxSnapshotAgeDays) {
      notes.push(`The ${name} is ${Math.floor(ageDays)} days old (limit ${maxSnapshotAgeDays}); nothing was drafted because claims could be out of date.`);
      return { decisions, nextLedger: previous ?? emptyLedger(), notes };
    }
  }

  const candidates: OssEvent[] = [];
  const record = (id: string, type: EventType, repository: string, outcome: Ledger["entries"][string]["outcome"]) => {
    ledger.entries[id] = { type, repository, decidedAt: nowIso, outcome };
  };

  // ---- Milestones (stars from GitHub, downloads/dependents from the registry) ----
  const projectsByRepo = new Map(snapshots.github.projects.map((project) => [project.repository, project]));
  const metricValues: Array<{ type: Exclude<EventType, "release">; repository: string; value: number; name: string; evidence: (threshold: number) => Evidence[] }> = [];

  for (const project of snapshots.github.projects) {
    if (!safeRepository.test(project.repository)) { notes.push(`Ignored project with unsafe repository name.`); continue; }
    metricValues.push({
      type: "stars-milestone", repository: project.repository, value: project.stars, name: project.name,
      evidence: (threshold) => [
        { label: "GitHub stars", value: project.stars, source: "data/github.generated.json", jsonPath: `projects[repository=${project.repository}].stars`, observedAt: snapshots.github.syncedAt, url: project.repositoryUrl },
        { label: "Milestone passed", value: threshold, source: "data/github.generated.json", jsonPath: "(threshold table in lib/oss-marketing.ts)", observedAt: snapshots.github.syncedAt }
      ]
    });
  }
  for (const item of snapshots.registry.packages) {
    if (!safeRepository.test(item.repository)) continue;
    const project = projectsByRepo.get(item.repository);
    const name = project?.name ?? item.repository;
    for (const [type, value, label, field] of [["downloads-milestone", item.downloads, "Total installs", "downloads"], ["dependents-milestone", item.dependents, "Dependent packages", "dependents"]] as const) {
      if (value === undefined) continue;
      metricValues.push({
        type, repository: item.repository, value, name,
        evidence: (threshold) => [
          { label, value, source: "data/package-registry.generated.json", jsonPath: `packages[packageName=${item.packageName}].${field}`, observedAt: snapshots.registry.syncedAt, url: packagistUrl(item) },
          { label: "Milestone passed", value: threshold, source: "data/package-registry.generated.json", jsonPath: "(threshold table in lib/oss-marketing.ts)", observedAt: snapshots.registry.syncedAt }
        ]
      });
    }
  }

  for (const metric of metricValues) {
    const thresholds = metricConfig[metric.type].thresholds.filter((threshold) => metric.value >= threshold);
    // --backfill: thresholds that were only recorded as a baseline (never announced) are eligible again.
    const fresh = thresholds.filter((threshold) => {
      const entry = ledger.entries[eventIdFor(metric.type, metric.repository, threshold)];
      return !entry || (options.backfill === true && entry.outcome === "baseline");
    });
    if (fresh.length === 0) continue;
    const highest = Math.max(...fresh);

    for (const threshold of fresh) {
      const id = eventIdFor(metric.type, metric.repository, threshold);
      const isHighest = threshold === highest;
      const alreadyBaselined = ledger.entries[id]?.outcome === "baseline";
      if (alreadyBaselined && !isHighest) continue;
      if (baselineRun && !(options.backfill && isHighest)) {
        record(id, metric.type, metric.repository, "baseline");
        decisions.push({ eventId: id, type: metric.type, repository: metric.repository, outcome: "baseline", reason: `Already true when tracking began (${metric.value.toLocaleString("en-US")} ${metricConfig[metric.type].noun}); recorded, not announced.` });
      } else if (!isHighest) {
        record(id, metric.type, metric.repository, "superseded");
        decisions.push({ eventId: id, type: metric.type, repository: metric.repository, outcome: "superseded", reason: `Crossed together with the higher milestone ${highest.toLocaleString("en-US")}; only the highest is announced.` });
      } else {
        candidates.push({
          id, type: metric.type, repository: metric.repository, projectName: metric.name, threshold,
          headline: `${metric.name} passed ${threshold.toLocaleString("en-US")} ${metricConfig[metric.type].noun}`,
          evidence: metric.evidence(threshold)
        });
      }
    }
  }

  // ---- Releases (registry latestVersion, compared with the last version we saw) ----
  for (const item of snapshots.registry.packages) {
    if (!safeRepository.test(item.repository) || !item.latestVersion) continue;
    const version = item.latestVersion;
    const last = ledger.lastSeenVersion[item.packageName];
    const project = projectsByRepo.get(item.repository);

    if (last === undefined) {
      ledger.lastSeenVersion[item.packageName] = version;
      if (options.backfill && baselineRun) {
        const parsed = parseSemver(version);
        if (parsed && !parsed.prerelease && (parsed.patch === 0)) {
          candidates.push(releaseEvent(item, project?.name ?? item.repository, version, snapshots.registry.syncedAt));
          continue;
        }
      }
      decisions.push({ eventId: eventIdFor("release", item.repository, version), type: "release", repository: item.repository, outcome: "baseline", reason: `Latest version ${version} recorded as the starting point; not announced.` });
      continue;
    }
    if (last === version) {
      const parsedCurrent = parseSemver(version);
      const entry = ledger.entries[eventIdFor("release", item.repository, version)];
      if (options.backfill && parsedCurrent && !parsedCurrent.prerelease && parsedCurrent.patch === 0 && (!entry || entry.outcome === "baseline")) {
        candidates.push(releaseEvent(item, project?.name ?? item.repository, version, snapshots.registry.syncedAt));
      }
      continue;
    }

    const id = eventIdFor("release", item.repository, version);
    const now_ = parseSemver(version);
    const before = parseSemver(last);
    if (!now_ || !before) {
      ledger.lastSeenVersion[item.packageName] = version;
      record(id, "release", item.repository, "skipped");
      decisions.push({ eventId: id, type: "release", repository: item.repository, outcome: "skip", reason: `Version "${version}" is not recognised semver, so it cannot be classified.` });
      continue;
    }
    if (now_.prerelease) {
      record(id, "release", item.repository, "skipped");
      decisions.push({ eventId: id, type: "release", repository: item.repository, outcome: "skip", reason: `${version} is a pre-release; announce the stable version instead.` });
      continue;
    }
    if (compareSemver(now_, before) <= 0) {
      ledger.lastSeenVersion[item.packageName] = version;
      record(id, "release", item.repository, "skipped");
      decisions.push({ eventId: id, type: "release", repository: item.repository, outcome: "skip", reason: `${version} is not newer than ${last}.` });
      continue;
    }
    if (now_.major === before.major && now_.minor === before.minor) {
      ledger.lastSeenVersion[item.packageName] = version;
      record(id, "release", item.repository, "skipped");
      decisions.push({ eventId: id, type: "release", repository: item.repository, outcome: "skip", reason: `${version} is a patch release (from ${last}); below the meaningful-change threshold.` });
      continue;
    }
    candidates.push(releaseEvent(item, project?.name ?? item.repository, version, snapshots.registry.syncedAt));
  }

  // ---- Rate limiting: cooldown per repository, cap per run ----
  candidates.sort((a, b) => priority[a.type] - priority[b.type] || a.repository.localeCompare(b.repository) || (b.threshold ?? 0) - (a.threshold ?? 0));
  const generatedThisRun = new Set<string>();
  let generated = 0;

  for (const event of candidates) {
    const lastGenerated = ledger.lastGeneratedAt[event.repository];
    const daysSince = lastGenerated ? (now.getTime() - new Date(lastGenerated).getTime()) / 86_400_000 : Infinity;

    if (generatedThisRun.has(event.repository)) {
      decisions.push({ eventId: event.id, type: event.type, repository: event.repository, outcome: "defer", reason: `${event.projectName} already has a bundle this run; this event is held for a later run so one project is not announced twice at once.` });
    } else if (daysSince < cooldownDays) {
      decisions.push({ eventId: event.id, type: event.type, repository: event.repository, outcome: "defer", reason: `${event.projectName} had a bundle ${Math.floor(daysSince)} days ago; cooldown is ${cooldownDays} days. Held, not dropped.` });
    } else if (generated >= maxPerRun) {
      decisions.push({ eventId: event.id, type: event.type, repository: event.repository, outcome: "defer", reason: `Per-run limit of ${maxPerRun} bundles reached; held for the next run.` });
    } else {
      generated++;
      generatedThisRun.add(event.repository);
      record(event.id, event.type, event.repository, "generated");
      ledger.lastGeneratedAt[event.repository] = nowIso;
      if (event.type === "release" && event.version) {
        const pkg = snapshots.registry.packages.find((item) => item.repository === event.repository);
        if (pkg) ledger.lastSeenVersion[pkg.packageName] = event.version;
      }
      decisions.push({ eventId: event.id, type: event.type, repository: event.repository, outcome: "generate", reason: event.headline, event });
    }
  }

  return { decisions, nextLedger: ledger, notes };
}

function releaseEvent(item: PackageRegistryStats & { repository: string }, projectName: string, version: string, syncedAt: string): OssEvent {
  return {
    id: eventIdFor("release", item.repository, version), type: "release", repository: item.repository, projectName, version,
    headline: `${projectName} ${version} released`,
    evidence: [
      { label: "Released version", value: version, source: "data/package-registry.generated.json", jsonPath: `packages[packageName=${item.packageName}].latestVersion`, observedAt: syncedAt, url: packagistUrl(item) },
      { label: "Release published", value: item.updatedAt.slice(0, 10), source: "data/package-registry.generated.json", jsonPath: `packages[packageName=${item.packageName}].updatedAt`, observedAt: syncedAt }
    ]
  };
}

/** What would qualify next, so a "nothing happened" run still tells the owner where things stand. */
export function describeProgress(snapshots: Snapshots, ledger: Ledger): string[] {
  const lines: string[] = [];
  for (const project of snapshots.github.projects) {
    const next = STAR_MILESTONES.find((threshold) => threshold > project.stars);
    if (next) lines.push(`${project.name}: ${project.stars.toLocaleString("en-US")} stars; next milestone ${next.toLocaleString("en-US")} (${(next - project.stars).toLocaleString("en-US")} to go).`);
  }
  for (const item of snapshots.registry.packages) {
    if (item.downloads !== undefined) {
      const next = DOWNLOAD_MILESTONES.find((threshold) => threshold > item.downloads!);
      if (next) lines.push(`${item.packageName}: ${item.downloads.toLocaleString("en-US")} installs; next milestone ${next.toLocaleString("en-US")}.`);
    }
    const seen = ledger.lastSeenVersion[item.packageName];
    if (seen) lines.push(`${item.packageName}: latest seen ${seen}; the next minor or major release qualifies, patch releases do not.`);
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------------------------

export const PLACEHOLDER = "[WRITE:";

export interface BundleContext {
  siteUrl: string;
  generatedAt: string;
  project?: GitHubProject;
}

/** Plain-text cleanup for data that originates outside this repo (descriptions, names). */
export function clean(text: string, limit = 300): string {
  // Drop control characters (external text), then collapse whitespace.
  const flattened = [...text].map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char)).join("").replace(/\s+/g, " ").trim();
  return flattened.length > limit ? `${flattened.slice(0, limit - 1).trimEnd()}…` : flattened;
}

export const bundleDirectoryName = (eventId: string) => eventId.replace(/:/g, "--");

function hashtags(project?: GitHubProject) {
  const tags = (project?.topics ?? []).map((topic) => topic.toLowerCase().replace(/[^a-z0-9]+/g, "")).filter((tag) => tag.length > 1 && tag.length < 20 && !/\d/.test(tag));
  return [...new Set(["opensource", "php", ...tags])].slice(0, 4).map((tag) => `#${tag}`).join(" ");
}

function evidenceTable(event: OssEvent) {
  const rows = event.evidence.map((item) => `| ${item.label} | ${typeof item.value === "number" ? item.value.toLocaleString("en-US") : item.value} | \`${item.source}\` \`${item.jsonPath}\` | ${item.observedAt.slice(0, 10)} |`);
  return ["| Claim | Value | Where it comes from | Observed |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

export function buildBundle(event: OssEvent, context: BundleContext): Record<string, string> {
  const { siteUrl, project } = context;
  const name = clean(event.projectName, 80);
  const description = clean(project?.description ?? "", 240);
  const canonical = `${siteUrl}/projects/${event.repository}`;
  const repoUrl = project?.repositoryUrl ?? `https://github.com/${event.repository}`;
  const campaign = bundleDirectoryName(event.id).replace(/[^A-Za-z0-9-]+/g, "-").toLowerCase();
  const links = {
    linkedin: withUtm(canonical, "linkedin", "social", campaign),
    devto: withUtm(canonical, "devto", "referral", campaign),
    reddit: withUtm(repoUrl, "reddit", "community", campaign),
    github: withUtm(canonical, "github", "referral", campaign)
  };
  const tags = hashtags(project);
  const milestone = event.threshold?.toLocaleString("en-US");
  const noun = event.type === "release" ? "" : metricConfig[event.type as Exclude<EventType, "release">].noun;
  const observed = event.evidence[0]?.observedAt.slice(0, 10) ?? "";
  const value = event.evidence[0]?.value;
  const valueText = typeof value === "number" ? value.toLocaleString("en-US") : String(value ?? "");
  const isRelease = event.type === "release";

  const factual = isRelease
    ? `${name} ${event.version} is available${event.evidence[1] ? ` (published ${event.evidence[1].value})` : ""}.`
    : `${name} has passed ${milestone} ${noun} (${valueText} as of ${observed}).`;

  const linkedin = isRelease
    ? `${name} ${event.version} is out.\n\n${description ? `${name} is ${description.replace(/^./, (c) => c.toLowerCase())}\n\n` : ""}${PLACEHOLDER} two or three concrete changes from the release notes — what a user can now do, or what got better. Be specific; leave this out entirely if there is nothing notable.]\n\nIt is open source: ${links.linkedin}\n\n${tags}\n`
    : `${name} has passed ${milestone} ${noun}.\n\n${PLACEHOLDER} one or two sentences of thanks and what you have learned maintaining it. Do not add numbers that are not in the evidence table.]\n\n${links.linkedin}\n\n${tags}\n`;

  const devto = `---\ntitle: ${isRelease ? `${name} ${event.version}: ${PLACEHOLDER} the headline change]` : `${PLACEHOLDER} a lesson from maintaining ${name}]`}\npublished: false\ncanonical_url: ${canonical}\ntags: ${tags.replace(/#/g, "").split(" ").filter(Boolean).slice(0, 4).join(", ")}\n---\n\nAngle options (pick one, delete the rest):\n\n- ${isRelease ? `What changed in ${event.version} and why (the problem it solves, a short example)` : `What maintaining ${name} has taught you (link to the existing Insights article if one applies)`}\n- A short tutorial that uses ${name} to solve one real task\n\nOutline:\n\n1. The problem\n2. The approach, with code\n3. What to try next\n\nRead more: ${links.devto}\n`;

  const community = isRelease
    ? `Suggested title: ${PLACEHOLDER} plain description of the problem ${name} ${event.version} helps with — not an announcement]\n\nDisclosure: I am the author of ${name}.\n\n${description ? `${name}: ${description}\n\n` : ""}${PLACEHOLDER} what is new in this release that would matter to someone in this community, with a short example or before/after. Lead with usefulness, not with the project.]\n\nRepository: ${links.reddit}\n\nBefore posting:\n- Read the community's self-promotion rules. If they forbid this kind of post, do not post it.\n- Post in one community only, and never paste the same text into several.\n- Be ready to answer questions and accept criticism; do not reply defensively.\n- Do not ask for upvotes or stars.\n`
    : `Not generated for this event. A number on its own is not news to a community and reads as self-promotion there; wait for the next release and use its community draft instead.\n`;

  const changelog = `### ${observed} — ${isRelease ? `${name} ${event.version}` : `${name}: ${milestone} ${noun}`}\n\n- ${factual}\n- ${PLACEHOLDER} one line on what changed, if anything]\n- Project page: ${canonical}\n`;

  const placeholders = [linkedin, devto, community, changelog].join("\n").split(PLACEHOLDER).length - 1;
  const summary = `# ${event.headline}\n\nStatus: **DRAFT — review before anything is published.** Nothing has been posted anywhere.\n\n## Why this qualified\n\n${isRelease ? `A new stable minor or major release (${event.version}) was published. Patch releases and pre-releases do not generate bundles.` : `A new milestone was crossed (${milestone} ${noun}). Only the highest newly crossed milestone is announced.`}\n\n## Facts you may state\n\n${factual}\n\n## Evidence\n\n${evidenceTable(event)}\n\nAnything not in this table is **not** verified. Do not add star, download, user, revenue, benchmark or testimonial claims that are not listed here.\n\n## Links\n\n- Canonical: ${canonical}\n- LinkedIn: ${links.linkedin}\n- DEV: ${links.devto}\n- Community: ${links.reddit}\n- Repository: ${repoUrl}\n\n## Review checklist\n\n- [ ] Replace every \`${PLACEHOLDER} …]\` marker (${placeholders} in this bundle) or delete the sentence\n- [ ] Every number in the final text appears in the evidence table\n${isRelease ? "- [ ] The release notes were read and the claims match them\n" : ""}- [ ] Posted by me, by hand, to one community at a time\n`;

  const metadata = {
    eventId: event.id,
    type: event.type,
    repository: event.repository,
    projectName: name,
    generatedAt: context.generatedAt,
    generatorVersion: GENERATOR_VERSION,
    canonicalUrl: canonical,
    trackedUrls: links,
    evidence: event.evidence,
    needsHumanInput: placeholders > 0,
    placeholders,
    autoPosted: false
  };

  const files: Record<string, string> = {
    "summary.md": summary,
    "linkedin.md": linkedin,
    "devto-outline.md": devto,
    "community.md": community,
    "changelog.md": changelog,
    "metadata.json": `${JSON.stringify(metadata, null, 2)}\n`
  };
  return files;
}

/**
 * Numbers in prose that are not backed by evidence: the automated "never invent stars, downloads,
 * users, revenue or benchmarks" check. URLs, the released version and ISO dates are excluded.
 */
export function findUnverifiedNumbers(text: string, event: OssEvent): string[] {
  const allowed = new Set<string>();
  for (const item of event.evidence) {
    const raw = String(item.value);
    allowed.add(raw);
    if (typeof item.value === "number") allowed.add(item.value.toLocaleString("en-US"));
    for (const part of raw.match(/\d[\d,.]*/g) ?? []) allowed.add(part);
  }
  if (event.threshold !== undefined) { allowed.add(String(event.threshold)); allowed.add(event.threshold.toLocaleString("en-US")); }

  const stripped = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/^\s*(?:\d+\.|-\s*\[[ x]\])\s/gm, " ")
    .replace(/\((\d+) in this bundle\)/g, " ")
    .replace(/`[^`]*`/g, " ");
  const found = stripped.match(/\d[\d,]*(?:\.\d+)*/g) ?? [];
  return [...new Set(found.map((token) => token.replace(/[.,]+$/, "")).filter((token) => !allowed.has(token)))];
}

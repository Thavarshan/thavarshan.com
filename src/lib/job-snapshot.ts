import { z } from "zod";
import {
  assessOpportunity,
  computeContentFingerprint,
  opportunitySnapshotSchema,
  type OpportunitySnapshot
} from "./job-opportunities";
import { parseSalary } from "./job-salary";

/**
 * Versioning policy (see docs/jobs-data.md):
 * - `schemaVersion` is bumped only for breaking changes (a removed/renamed field or a narrowed enum).
 * - Purely additive fields ship with a zod default and do NOT bump the version.
 * - Every bump must add a `migrate` step below and a fixture of the previous version under tests/fixtures/jobs.
 * - Snapshots newer than this code, or that fail validation after migration, are refused, never reset.
 */
export const CURRENT_SCHEMA_VERSION = 2;

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

export interface LoadedSnapshot {
  snapshot: OpportunitySnapshot;
  /** The on-disk version if it was migrated forward, otherwise null. */
  migratedFrom: number | null;
}

const legacyV1RecordSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["larajobs", "laravel-news"]),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  company: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  salary: z.string().nullable(),
  descriptionText: z.string(),
  tags: z.array(z.string()).default([]),
  publishedAt: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  eligibility: z.enum(["eligible", "ineligible", "unknown"]),
  sponsorship: z.enum(["confirmed", "unavailable", "unknown"]),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  concerns: z.array(z.string())
});

const legacyV1SnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  candidate: z.unknown(),
  sources: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    collectedAt: z.string().datetime(),
    recordsFound: z.number().int().nonnegative()
  })),
  opportunities: z.array(legacyV1RecordSchema)
});

/** v1 → v2: derives the fields v2 made required from the stored text; stored eligibility/score are preserved. */
function migrateV1(raw: unknown): unknown {
  const legacy = legacyV1SnapshotSchema.parse(raw);
  return {
    ...legacy,
    schemaVersion: 2,
    sources: legacy.sources.map((source) => ({
      ...source, status: "ok", added: 0, updated: 0, closed: 0, skipped: 0, rejected: 0, error: null
    })),
    opportunities: legacy.opportunities.map((record) => {
      const derived = assessOpportunity({ title: record.title, descriptionText: record.descriptionText, location: record.location, tags: record.tags });
      const { salaryMin, salaryMax, salaryCurrency } = parseSalary(record.salary);
      return {
        ...record,
        workArrangement: derived.workArrangement,
        seniority: derived.seniority,
        salaryMin,
        salaryMax,
        salaryCurrency,
        contentFingerprint: computeContentFingerprint(record.company, record.title),
        duplicateOfIds: [],
        status: "active",
        closedAt: null
      };
    })
  };
}

const migrations: Record<number, (raw: unknown) => unknown> = { 1: migrateV1 };

function describeIssues(error: z.ZodError) {
  const shown = error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
  const more = error.issues.length > shown.length ? ` (+${error.issues.length - shown.length} more)` : "";
  return `${shown.join("; ")}${more}`;
}

/** Parses untrusted snapshot JSON into the current schema, migrating forward. Throws SnapshotError; never returns a partial result. */
export function loadSnapshot(raw: unknown): LoadedSnapshot {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SnapshotError("Snapshot is not a JSON object");
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new SnapshotError("Snapshot has no integer schemaVersion");
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SnapshotError(`Snapshot schemaVersion ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}; refusing to downgrade`);
  }

  let current: unknown = raw;
  let migrated = false;
  for (let step = version; step < CURRENT_SCHEMA_VERSION; step++) {
    const migrate = migrations[step];
    if (!migrate) throw new SnapshotError(`No migration from schemaVersion ${step}`);
    try {
      current = migrate(current);
    } catch (error) {
      const detail = error instanceof z.ZodError ? describeIssues(error) : error instanceof Error ? error.message : String(error);
      throw new SnapshotError(`Migration from schemaVersion ${step} failed: ${detail}`);
    }
    migrated = true;
  }

  const parsed = opportunitySnapshotSchema.safeParse(current);
  if (!parsed.success) throw new SnapshotError(`Snapshot failed validation: ${describeIssues(parsed.error)}`);
  return { snapshot: parsed.data, migratedFrom: migrated ? version : null };
}

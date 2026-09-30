// @vitest-environment node
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION, SnapshotError, loadSnapshot } from "@/features/jobs/snapshot";
import { readExisting } from "@automation/jobs/collect";

const read = async (path: string) => JSON.parse(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"));
const clone = <T>(value: T): T => structuredClone(value);

describe("loadSnapshot: current data", () => {
  it("loads the committed snapshot without migration", async () => {
    const { snapshot, migratedFrom } = loadSnapshot(await read("data/jobs.generated.json"));
    expect(migratedFrom).toBeNull();
    expect(snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("accepts a v2 snapshot written before additive fields existed, filling defaults", async () => {
    const raw = clone(await read("data/jobs.generated.json"));
    for (const item of raw.opportunities) {
      delete item.scoreBreakdown;
      delete item.confidence;
      delete item.confidenceBreakdown;
    }
    const { snapshot, migratedFrom } = loadSnapshot(raw);
    expect(migratedFrom).toBeNull();
    expect(snapshot.opportunities[0]).toMatchObject({ scoreBreakdown: [], confidence: null, confidenceBreakdown: [] });
  });
});

describe("loadSnapshot: legacy v1 fixture (real historical snapshot)", () => {
  it("migrates forward, preserving stored facts and deriving the newly required fields", async () => {
    const v1 = await read("tests/fixtures/jobs/snapshot-v1.json");
    const { snapshot, migratedFrom } = loadSnapshot(v1);
    expect(migratedFrom).toBe(1);
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.opportunities).toHaveLength(v1.opportunities.length);
    snapshot.opportunities.forEach((item, index) => {
      const before = v1.opportunities[index];
      expect(item).toMatchObject({ id: before.id, canonicalUrl: before.canonicalUrl, score: before.score, eligibility: before.eligibility, status: "active", closedAt: null, duplicateOfIds: [] });
      expect(item.contentFingerprint).toMatch(/^[a-f0-9]{20}$/);
      expect(["junior", "mid", "senior", "lead", "unknown"]).toContain(item.seniority);
      expect(item.workArrangement).toBeTruthy();
    });
    expect(snapshot.sources[0]).toMatchObject({ status: "ok", error: null, added: 0 });
  });

  it("is idempotent: the migrated output loads again with no further migration", async () => {
    const { snapshot } = loadSnapshot(await read("tests/fixtures/jobs/snapshot-v1.json"));
    expect(loadSnapshot(JSON.parse(JSON.stringify(snapshot))).migratedFrom).toBeNull();
  });

  it("fails the whole migration on one corrupt record instead of silently dropping it", async () => {
    const v1 = clone(await read("tests/fixtures/jobs/snapshot-v1.json"));
    v1.opportunities[1].score = 900;
    expect(() => loadSnapshot(v1)).toThrow(/Migration from schemaVersion 1 failed.*score/);
  });
});

describe("loadSnapshot: malformed input is refused", () => {
  const good = () => read("data/jobs.generated.json").then(clone);

  it.each([
    ["not an object", "hello", /not a JSON object/],
    ["an array", [], /not a JSON object/],
    ["null", null, /not a JSON object/],
    ["no schemaVersion", {}, /no integer schemaVersion/],
    ["string schemaVersion", { schemaVersion: "2" }, /no integer schemaVersion/],
    ["fractional schemaVersion", { schemaVersion: 1.5 }, /no integer schemaVersion/],
    ["a newer schemaVersion", { schemaVersion: 3 }, /newer than supported.*refusing to downgrade/],
    ["an unknown old schemaVersion", { schemaVersion: 0 }, /No migration from schemaVersion 0/]
  ])("rejects %s", (_name, raw, message) => {
    expect(() => loadSnapshot(raw)).toThrow(SnapshotError);
    expect(() => loadSnapshot(raw)).toThrow(message);
  });

  it("rejects out-of-range scores, bad enums, invalid URLs and missing fields, naming the field", async () => {
    type Raw = { generatedAt: string; opportunities: Array<Record<string, unknown>> | string };
    const first = (d: Raw) => (d.opportunities as Array<Record<string, unknown>>)[0];
    const cases: Array<[(d: Raw) => void, RegExp]> = [
      [(d) => { first(d).score = 101; }, /opportunities\.0\.score/],
      [(d) => { first(d).eligibility = "maybe"; }, /opportunities\.0\.eligibility/],
      [(d) => { first(d).canonicalUrl = "not a url"; }, /opportunities\.0\.canonicalUrl/],
      [(d) => { first(d).source = "monster"; }, /opportunities\.0\.source/],
      [(d) => { delete first(d).id; }, /opportunities\.0\.id/],
      [(d) => { d.generatedAt = "yesterday"; }, /generatedAt/],
      [(d) => { d.opportunities = "none"; }, /opportunities/]
    ];
    for (const [mutate, expected] of cases) {
      const raw = await good();
      mutate(raw);
      expect(() => loadSnapshot(raw)).toThrow(expected);
    }
  });

  it("summarises many issues rather than dumping them all", async () => {
    const raw = await good();
    for (const item of raw.opportunities) item.score = -5;
    expect(() => loadSnapshot(raw)).toThrow(/\(\+\d+ more\)/);
  });
});

describe("readExisting (collector guard)", () => {
  const dir = () => mkdtemp(join(tmpdir(), "jobs-snapshot-"));

  it("returns null only when there is no snapshot yet (first run)", async () => {
    expect(await readExisting(join(await dir(), "missing.json"), false)).toBeNull();
  });

  it("loads a valid snapshot and migrates a legacy one", async () => {
    const path = join(await dir(), "jobs.json");
    await writeFile(path, JSON.stringify(await read("tests/fixtures/jobs/snapshot-v1.json")));
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await readExisting(path, false))?.schemaVersion).toBe(2);
  });

  it("refuses to overwrite a corrupt or invalid snapshot, so history is never silently discarded", async () => {
    const path = join(await dir(), "jobs.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 2, opportunities: "broken" }));
    await expect(readExisting(path, false)).rejects.toThrow(/Refusing to overwrite unusable/);
    await writeFile(path, "{ not json");
    await expect(readExisting(path, false)).rejects.toThrow();
    await writeFile(path, JSON.stringify({ schemaVersion: 99 }));
    await expect(readExisting(path, false)).rejects.toThrow(/newer than supported/);
  });

  it("starts fresh only when a reset is explicitly requested", async () => {
    const path = join(await dir(), "jobs.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 2, opportunities: "broken" }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readExisting(path, true)).toBeNull();
  });
});

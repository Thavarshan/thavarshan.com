import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, parseReviewMap } from "@/features/jobs/review";

const ID = "0123456789abcdef0123";
const entry = { status: "shortlisted", note: "call back", updatedAt: "2026-09-29T12:00:00.000Z" };

describe("parseReviewMap", () => {
  it("accepts an empty map and valid entries for every status", () => {
    expect(parseReviewMap({})).toEqual({});
    const all = { a: { ...entry, status: "new" }, b: { ...entry, status: "reviewed" }, c: entry, d: { ...entry, status: "dismissed", note: "" } };
    expect(parseReviewMap(all)).toEqual(all);
  });

  it.each([null, [], "text", 5, true, undefined, [entry]])("rejects a non-object top level: %j", (value) => {
    expect(parseReviewMap(value)).toBeNull();
  });

  it.each([
    ["null entry", { [ID]: null }],
    ["array entry", { [ID]: [] }],
    ["invalid status", { [ID]: { ...entry, status: "archived" } }],
    ["missing status", { [ID]: { note: "", updatedAt: "x" } }],
    ["non-string note", { [ID]: { ...entry, note: 5 } }],
    ["missing note", { [ID]: { status: "new", updatedAt: "x" } }],
    ["oversized note", { [ID]: { ...entry, note: "n".repeat(NOTE_MAX_LENGTH + 1) } }],
    ["missing timestamp", { [ID]: { status: "new", note: "" } }],
    ["empty timestamp", { [ID]: { ...entry, updatedAt: "" } }],
    ["non-string timestamp", { [ID]: { ...entry, updatedAt: 1759150000 } }],
    ["one bad entry among good ones", { good: entry, [ID]: { ...entry, status: "nope" } }]
  ])("rejects %s", (_name, value) => {
    expect(parseReviewMap(value)).toBeNull();
  });

  it("returns only known fields so stray data is not carried forward", () => {
    expect(parseReviewMap({ [ID]: { ...entry, extra: "x" } })).toEqual({ [ID]: entry });
  });
});

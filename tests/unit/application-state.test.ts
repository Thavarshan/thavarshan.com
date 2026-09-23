import { describe, expect, it } from "vitest";
import { applicationStateSchema } from "@/scripts/applications/state";

describe("applicationStateSchema", () => {
  it("defaults status to pending and respondedAt to null for an old-shape entry", () => {
    const parsed = applicationStateSchema.parse({
      schemaVersion: 1,
      entries: [
        {
          opportunityId: "abc123",
          inputHash: "hash1",
          generatedAt: "2026-09-23T00:00:00.000Z",
          model: "gpt-4o-mini"
        }
      ]
    });

    expect(parsed.entries[0].status).toBe("pending");
    expect(parsed.entries[0].respondedAt).toBeNull();
  });

  it("parses a full new-shape entry unchanged", () => {
    const entry = {
      opportunityId: "abc123",
      inputHash: "hash1",
      generatedAt: "2026-09-23T00:00:00.000Z",
      model: "gpt-4o-mini",
      status: "applied" as const,
      respondedAt: "2026-09-24T00:00:00.000Z"
    };

    const parsed = applicationStateSchema.parse({ schemaVersion: 1, entries: [entry] });
    expect(parsed.entries[0]).toEqual(entry);
  });

  it("rejects an invalid status value", () => {
    expect(() =>
      applicationStateSchema.parse({
        schemaVersion: 1,
        entries: [
          {
            opportunityId: "abc123",
            inputHash: "hash1",
            generatedAt: "2026-09-23T00:00:00.000Z",
            model: "gpt-4o-mini",
            status: "submitted"
          }
        ]
      })
    ).toThrow();
  });
});

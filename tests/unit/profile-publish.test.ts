import { describe, expect, it } from "vitest";
import { parseChangedFiles } from "../../scripts/profile/publish";

describe("profile publishing status parsing", () => {
  it("preserves the first character of changed filenames", () => {
    expect(parseChangedFiles(" M data/profile.generated.json\0")).toEqual(["data/profile.generated.json"]);
  });

  it("includes both paths for renames", () => {
    expect(parseChangedFiles("R  data/profile.generated.json\0data/profile.previous.json\0")).toEqual([
      "data/profile.generated.json",
      "data/profile.previous.json"
    ]);
  });
});

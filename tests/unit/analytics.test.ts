import { describe, expect, it } from "vitest";
import { withUtm } from "@/lib/analytics";

describe("analytics helpers", () => {
  it("adds standard campaign parameters", () => {
    expect(withUtm("https://thavarshan.com/insights/test", "linkedin", "social", "test")).toBe(
      "https://thavarshan.com/insights/test?utm_source=linkedin&utm_medium=social&utm_campaign=test"
    );
  });
});

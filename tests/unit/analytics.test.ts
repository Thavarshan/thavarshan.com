import { describe, expect, it } from "vitest";
import { plausibleEventClass, withUtm } from "@/lib/analytics";

describe("analytics helpers", () => {
  it("formats Plausible tagged-event classes", () => {
    expect(plausibleEventClass("Resume Download")).toBe("plausible-event-name=Resume+Download");
  });

  it("adds standard campaign parameters", () => {
    expect(withUtm("https://thavarshan.com/insights/test", "linkedin", "social", "test")).toBe(
      "https://thavarshan.com/insights/test?utm_source=linkedin&utm_medium=social&utm_campaign=test"
    );
  });
});

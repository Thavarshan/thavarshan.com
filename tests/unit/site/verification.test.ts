import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import actual root metadata so dropping the helper from layout fails this regression.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("root ownership metadata", () => {
  it("wires build-time values into the root metadata", async () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "fixture-google-build");
    vi.stubEnv("BING_SITE_VERIFICATION", "fixture-bing-build");
    const { metadata } = await import("../../../src/app/layout");
    expect(metadata.verification).toEqual({ google: "fixture-google-build", other: { "msvalidate.01": ["fixture-bing-build"] } });
  });
  it("does not create placeholder verification when unconfigured", async () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "");
    vi.stubEnv("BING_SITE_VERIFICATION", "");
    const { metadata } = await import("../../../src/app/layout");
    expect(metadata.verification).toEqual({});
  });
  it("keeps the robots route as the only source", () => {
    expect(existsSync("src/app/robots.ts")).toBe(true);
    expect(existsSync("public/robots.txt")).toBe(false);
    expect(existsSync("public/_robots.txt")).toBe(false);
  });
});

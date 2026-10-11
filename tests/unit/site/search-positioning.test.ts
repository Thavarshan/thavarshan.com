import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import positioning from "../../../marketing/search-positioning.json";
import sitemap from "../../../src/app/sitemap";
import { validatePositioning } from "../../../automation/marketing/positioning/model";

const paths = sitemap().map((entry) => new URL(entry.url).pathname);
describe("search positioning", () => {
  it("covers every current indexable page with existing public evidence", () => {
    const map = validatePositioning(positioning, paths);
    for (const page of map.pages) for (const source of page.evidence) expect(existsSync(source), source).toBe(true);
  });
  it("requires review when a new page has no intent or an old route disappears", () => {
    expect(() => validatePositioning(positioning, [...paths, "/new-page"])).toThrow(/canonical/);
    expect(() => validatePositioning(positioning, paths.slice(1))).toThrow(/canonical/);
  });
  it("rejects competing intent, duplicate routes and broken CTA destinations", () => {
    const copy = () => structuredClone(positioning);
    const competing = copy();
    competing.pages[1].primaryIntent = competing.pages[0].primaryIntent;
    expect(() => validatePositioning(competing, paths)).toThrow(/Competing/);
    const duplicate = copy();
    duplicate.pages[1].path = duplicate.pages[0].path;
    expect(() => validatePositioning(duplicate, paths)).toThrow(/Duplicate/);
    const broken = copy();
    broken.pages[0].cta = "/missing";
    expect(() => validatePositioning(broken, paths)).toThrow(/unknown/);
  });
});

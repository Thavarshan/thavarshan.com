// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import githubData from "@generated/github.generated.json";

describe("off-site backlink destination map", () => {
  const document = readFileSync("docs/backlink-distribution.md", "utf8");

  it("links every featured public project to its live, canonical portfolio route", () => {
    const mapped = [...document.matchAll(/`https:\/\/thavarshan\.com\/projects\/([a-z0-9-]+)`/g)].map((match) => match[1]);
    const featured = githubData.projects.map((project) => project.repository);
    expect(mapped.sort()).toEqual(featured.sort());
  });

  it("keeps canonical destination URLs free of campaign parameters", () => {
    const destinations = [...document.matchAll(/`(https:\/\/thavarshan\.com[^`]*)`/g)].map((match) => match[1]);
    expect(destinations.length).toBeGreaterThan(6);
    for (const destination of destinations) expect(new URL(destination).search).toBe("");
  });
});

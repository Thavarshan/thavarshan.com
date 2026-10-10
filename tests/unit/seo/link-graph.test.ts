// @vitest-environment node
import { describe, expect, it } from "vitest";
import { auditLinkGraph, maxCrawlDepth } from "../../../automation/seo/link-graph";

const page = (path: string, links: string[] = []) => ({ url: `https://thavarshan.com${path}`, links });

describe("homepage link graph", () => {
  it("detects a disconnected cycle even though every page has an inbound link", () => {
    const result = auditLinkGraph([page("/", ["/tools"]), page("/tools"), page("/a", ["/b"]), page("/b", ["/a"])]);
    expect(result.pages.filter((item) => item.depth === null).map((item) => item.path)).toEqual(["/a", "/b"]);
  });
  it("measures shortest depth and deduplicates links with queries or fragments", () => {
    const result = auditLinkGraph([page("/", ["/a", "/a?source=home", "#hire", "/b"]), page("/a", ["/b", "/c#example"]), page("/b", ["/c"]), page("/c")]);
    expect(result.pages.map(({ path, depth }) => ({ path, depth }))).toEqual([
      { path: "/", depth: 0 },
      { path: "/a", depth: 1 },
      { path: "/b", depth: 1 },
      { path: "/c", depth: 2 }
    ]);
    expect(result.pages[0].outgoingPaths).toEqual(["/a", "/b"]);
  });
  it("excludes external, malformed and unaudited destinations", () => {
    const result = auditLinkGraph([page("/", ["https://example.com/a", "http://[", "/missing", "mailto:hi@example.com"]), page("/a")]);
    expect(result.pages[0].outgoingPaths).toEqual([]);
    expect(result.pages[1].depth).toBeNull();
  });
  it("retains excessive depths for the rendered audit to fail", () => {
    const result = auditLinkGraph([page("/", ["/1"]), ...Array.from({ length: 4 }, (_, i) => page(`/${i + 1}`, i < 3 ? [`/${i + 2}`] : []))]);
    expect(result.pages.filter((item) => item.depth !== null && item.depth > maxCrawlDepth).map((item) => item.path)).toEqual(["/4"]);
  });
  it("does not invent reachability when home is missing", () => {
    expect(auditLinkGraph([page("/a", ["/b"]), page("/b")]).pages.every((item) => item.depth === null)).toBe(true);
  });
});

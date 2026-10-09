import { describe, expect, it } from "vitest";
import { canonicalOrigin } from "@automation/seo/rules";
import {
  checkLifecycle,
  checkHostRedirectOwnership,
  checkLifecycleLinks,
  checkPreviousLifecycle,
  exportedPaths,
  lifecycleSchema,
  parseContentRedirects,
  type Lifecycle
} from "@automation/seo/lifecycle";

const current: Lifecycle = { schemaVersion: 1, pages: ["/", "/projects/new"], retired: [] };
const files = ["index.html", "projects/new.html", "404.html", "_not-found.html", "_redirects", "docs/cv.pdf"];
const rules = (value: string) => parseContentRedirects(value);
const names = (value: ReturnType<typeof checkLifecycle>) => value.map((item) => item.rule);

describe("URL lifecycle", () => {
  it("accepts exact permanent moves to real pages or static assets", () => {
    expect(
      checkLifecycle(
        current,
        rules("# retained aliases\n/old /projects/new 301!\n/cv-old /docs/cv.pdf 301!\n/legacy https://github.com/Thavarshan/comet 301!"),
        files
      )
    ).toEqual([]);
  });
  it("rejects missing individual slugs even when a route pattern still exists", () => {
    const previous = { ...current, pages: [...current.pages, "/projects/missing"] };
    expect(names(checkLifecycle(previous, [], files))).toContain("page-removed");
    expect(names(checkLifecycle(current, [], [...files, "projects/unregistered.html"]))).toContain("page-unregistered");
  });
  it("rejects chains, cycles, duplicate sources and self redirects", () => {
    expect(names(checkLifecycle(current, rules("/a /b 301!\n/b /projects/new 301!"), files))).toContain("redirect-chain");
    expect(names(checkLifecycle(current, rules("/a /b 301!\n/b /a 301!"), files))).toContain("redirect-loop");
    expect(names(checkLifecycle(current, rules("/a /a 301!"), files))).toContain("redirect-loop");
    expect(names(checkLifecycle(current, rules("/a / 301!\n/a /projects/new 301!"), files))).toContain("redirect-duplicate");
  });
  it("recognizes same-origin absolute targets and rejects missing or retired targets", () => {
    expect(names(checkLifecycle(current, rules(`/old ${canonicalOrigin}/missing 301!`), files))).toContain("redirect-target");
    expect(
      names(checkLifecycle({ ...current, retired: [{ path: "/removed", status: 404, reason: "No successor" }] }, rules("/old /removed 301!"), files))
    ).toContain("redirect-target");
  });
  it("retirement must genuinely remove exported files and cannot remain active", () => {
    const retired = { ...current, retired: [{ path: "/projects/new", status: 404 as const, reason: "Removed" }] };
    expect(names(checkLifecycle(retired, [], files))).toEqual(expect.arrayContaining(["retired-active", "retired-exported"]));
    expect(checkLifecycle({ ...current, retired: [{ path: "/removed", status: 404, reason: "No useful replacement" }] }, [], files)).toEqual([]);
  });
  it("blocks forced redirects over active/exported source pages", () => {
    expect(names(checkLifecycle(current, rules("/projects/new / 301!"), files))).toContain("redirect-source-conflict");
  });
  it("blocks internal links to moved/retired paths, including encoded and relative links", () => {
    const pages = [
      {
        url: `${canonicalOrigin}/projects/new`,
        links: ["/old?utm=x", "../removed", `${canonicalOrigin}/%6Fld`, "https://example.com/old", "#section", "mailto:me@example.com"]
      }
    ];
    const failures = checkLifecycleLinks(pages, rules("/old / 301!"), [{ path: "/removed", status: 404, reason: "Removed" }]);
    expect(failures).toHaveLength(3);
    expect(failures.every((item) => item.rule === "internal-link-lifecycle")).toBe(true);
  });
  it("cannot erase published pages or legacy redirects by editing their registers", () => {
    const previous = { ...current, pages: [...current.pages, "/older"] };
    expect(names(checkPreviousLifecycle(previous, current, []))).toContain("url-history-lost");
    expect(checkPreviousLifecycle(previous, current, rules("/older /projects/new 301!"))).toEqual([]);
    expect(checkPreviousLifecycle(previous, { ...current, retired: [{ path: "/older", status: 404, reason: "No equivalent" }] }, [])).toEqual([]);
    expect(names(checkPreviousLifecycle(current, current, [], rules("/legacy / 301!")))).toContain("url-history-lost");
  });
  it.each([
    "/a / 200!",
    "/a / 302!",
    "/a / 301",
    "/a/* / 301!",
    "/a /missing?x=1 301!",
    "/a https://user:pass@example.com/ 301!",
    "/a javascript:alert(1) 301!",
    "/a //evil.example/ 301!",
    "/a / 301! Country=US",
    "/../a / 301!"
  ])("fails closed on unsupported or unsafe rules: %s", (rule) => {
    expect(() => rules(rule)).toThrow();
  });
  it("prevents content rules and chains through alias hosts from bypassing the owned graph", () => {
    const block = '[[redirects]]\nfrom = "https://thavarshan.netlify.app/*"\nto = "https://thavarshan.com/:splat"\nstatus = 301\nforce = true\n';
    expect(checkHostRedirectOwnership(block)).toEqual([]);
    expect(checkHostRedirectOwnership(block + '[[redirects]]\nfrom = "/old"\nto = "/"\nstatus = 301\n').map((item) => item.rule)).toContain(
      "redirect-ownership"
    );
    expect(() => rules("/old https://www.thavarshan.com/projects 301!")).toThrow();
    expect(
      checkLifecycleLinks([{ url: canonicalOrigin, links: ["https://www.thavarshan.com/projects", "http://thavarshan.com/projects"] }], [], [])
    ).toHaveLength(2);
  });
  it("validates canonical page records and retirement reasons", () => {
    expect(() => lifecycleSchema.parse({ ...current, pages: ["/projects/"] })).toThrow();
    expect(() => lifecycleSchema.parse({ ...current, retired: [{ path: "/old", status: 404, reason: " " }] })).toThrow();
    expect(exportedPaths(files).pages).toEqual(current.pages);
  });
});

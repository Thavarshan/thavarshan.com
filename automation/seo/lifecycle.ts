import { z } from "zod";
import { canonicalOrigin, type SeoFailure, type SeoPage } from "./rules";

const pathSchema = z
  .string()
  .refine(
    (path) => /^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?$/.test(path) && !path.split("/").some((part) => part === "." || part === ".."),
    "Expected a canonical exact path with no query, fragment or trailing slash"
  );
export const lifecycleSchema = z.object({
  schemaVersion: z.literal(1),
  pages: z.array(pathSchema).min(1),
  retired: z.array(z.object({ path: pathSchema, status: z.literal(404), reason: z.string().trim().min(1) }))
});
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export interface ContentRedirect {
  from: string;
  to: string;
  status: 301;
}

/** Intentionally supports only the exact, forced permanent rules this static site owns. */
export function parseContentRedirects(input: string): ContentRedirect[] {
  return input.split(/\r?\n/).flatMap((line, index) => {
    const value = line.replace(/\s+#.*$/, "").trim();
    if (!value || value.startsWith("#")) return [];
    const [from, to, status, ...extra] = value.split(/\s+/);
    if (!pathSchema.safeParse(from).success || !to || status !== "301!" || extra.length)
      throw new Error(`Unsupported content redirect on line ${index + 1}; use an exact canonical path and 301!`);
    const target = new URL(to, canonicalOrigin);
    if (["www.thavarshan.com", "thavarshan.netlify.app"].includes(target.hostname))
      throw new Error(`Redirect target must use the final canonical host on line ${index + 1}`);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.search ||
      target.hash ||
      (target.origin === canonicalOrigin && !pathSchema.safeParse(target.pathname).success)
    )
      throw new Error(`Invalid redirect target on line ${index + 1}`);
    if (to.startsWith("//") || (!to.startsWith("/") && !to.startsWith("https://"))) throw new Error(`Invalid redirect target on line ${index + 1}`);
    return [{ from, to, status: 301 as const }];
  });
}

export function contentPath(url: string, source = canonicalOrigin): string | null {
  try {
    const parsed = new URL(url, source);
    if (parsed.origin !== canonicalOrigin) return null;
    return decodeURIComponent(parsed.pathname).replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

export function exportedPaths(files: string[]): { pages: string[]; served: Set<string> } {
  const served = new Set<string>();
  const pages: string[] = [];
  for (const file of files) {
    if (["404.html", "_not-found.html", "_headers", "_redirects"].includes(file) || /(^|\/)__next/.test(file)) continue;
    const path = file.endsWith(".html") ? (file === "index.html" ? "/" : `/${file.replace(/(?:\/index)?\.html$/, "")}`) : `/${file}`;
    served.add(path);
    if (file.endsWith(".html")) pages.push(path);
  }
  return { pages: pages.sort(), served };
}

export function checkLifecycle(lifecycle: Lifecycle, redirects: ContentRedirect[], files: string[]): SeoFailure[] {
  const failures: SeoFailure[] = [];
  const fail = (path: string, rule: string, detail: string) => failures.push({ url: `${canonicalOrigin}${path}`, rule, detail });
  const { pages, served } = exportedPaths(files);
  const retired = new Set(lifecycle.retired.map((item) => item.path));
  const bySource = new Map<string, ContentRedirect>();
  for (const paths of [lifecycle.pages, lifecycle.retired.map((item) => item.path)]) {
    const seen = new Set<string>();
    for (const path of paths) {
      if (seen.has(path)) fail(path, "lifecycle-duplicate", "URL appears more than once in the register");
      seen.add(path);
    }
  }
  for (const redirect of redirects) {
    if (bySource.has(redirect.from)) fail(redirect.from, "redirect-duplicate", "Duplicate redirect source");
    bySource.set(redirect.from, redirect);
    if (served.has(redirect.from) || lifecycle.pages.includes(redirect.from) || retired.has(redirect.from))
      fail(redirect.from, "redirect-source-conflict", "Redirect source is still exported, active or retired");
  }
  for (const redirect of redirects) {
    const target = contentPath(redirect.to);
    if (target && bySource.has(target)) {
      fail(redirect.from, "redirect-chain", "Point directly to the final destination instead of another redirect");
      const seen = new Set([redirect.from]);
      let current: string | null = target;
      while (current && bySource.has(current)) {
        if (seen.has(current)) {
          fail(redirect.from, "redirect-loop", "Redirect cycle detected");
          break;
        }
        seen.add(current);
        current = contentPath(bySource.get(current)!.to);
      }
    }
    if (target && (!served.has(target) || retired.has(target))) fail(redirect.from, "redirect-target", "Internal destination must be an exported final URL");
  }
  for (const path of lifecycle.pages) {
    if (!pages.includes(path)) fail(path, "page-removed", "Registered page is missing: preserve it or record a reviewed redirect/404 retirement");
    if (retired.has(path)) fail(path, "retired-active", "Retired URL cannot remain active");
  }
  for (const path of pages) if (!lifecycle.pages.includes(path)) fail(path, "page-unregistered", "Add the new page to the reviewed URL register");
  for (const path of retired) if (served.has(path)) fail(path, "retired-exported", "Retired URL is still exported and would return 200");
  return failures;
}

export function checkLifecycleLinks(pages: Pick<SeoPage, "url" | "links">[], redirects: ContentRedirect[], retired: Lifecycle["retired"]): SeoFailure[] {
  const unavailable = new Set([...redirects.map((item) => item.from), ...retired.map((item) => item.path)]);
  return pages.flatMap((page) =>
    page.links.flatMap((link) => {
      try {
        const target = new URL(link, page.url);
        if (["thavarshan.com", "www.thavarshan.com", "thavarshan.netlify.app"].includes(target.hostname) && target.origin !== canonicalOrigin)
          return [{ url: page.url, rule: "internal-link-lifecycle", detail: "Link uses a redirecting production alias; use the canonical HTTPS origin" }];
      } catch {
        /* Existing rendered HTTP checks handle other invalid links. */
      }
      const path = contentPath(link, page.url);
      return path && unavailable.has(path)
        ? [{ url: page.url, rule: "internal-link-lifecycle", detail: `Link targets a moved or retired URL: ${path}; use the final canonical destination` }]
        : [];
    })
  );
}

/** Historical URLs must stay represented even when a PR edits the current register. */
export function checkPreviousLifecycle(
  previous: Lifecycle,
  current: Lifecycle,
  redirects: ContentRedirect[],
  previousRedirects: ContentRedirect[] = []
): SeoFailure[] {
  const accounted = new Set([...current.pages, ...current.retired.map((item) => item.path), ...redirects.map((item) => item.from)]);
  return [...previous.pages, ...previous.retired.map((item) => item.path), ...previousRedirects.map((item) => item.from)]
    .filter((path) => !accounted.has(path))
    .map((path) => ({
      url: `${canonicalOrigin}${path}`,
      rule: "url-history-lost",
      detail: "Previously published URL has no active page, permanent redirect or documented retirement"
    }));
}

/** Keep content rules out of TOML so the owned graph cannot be bypassed by precedence. */
export function checkHostRedirectOwnership(toml: string): SeoFailure[] {
  const blocks = toml.split(/^\[\[redirects\]\]\s*$/m).slice(1);
  const expected = { from: '"https://thavarshan.netlify.app/*"', to: '"https://thavarshan.com/:splat"', status: "301", force: "true" };
  const valid =
    blocks.length === 1 &&
    blocks.every((block) => {
      const fields = block
        .split(/^\[/m)[0]
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+#.*$/, "").trim())
        .filter((line) => line && !line.startsWith("#"));
      const pairs = fields.map((line) => line.match(/^(\w+)\s*=\s*(.+)$/));
      return (
        pairs.length === Object.keys(expected).length &&
        pairs.every((pair) => pair && Object.hasOwn(expected, pair[1]) && expected[pair[1] as keyof typeof expected] === pair[2]) &&
        new Set(pairs.map((pair) => pair?.[1])).size === pairs.length
      );
    });
  return valid
    ? []
    : [
        {
          url: canonicalOrigin,
          rule: "redirect-ownership",
          detail: "netlify.toml must contain only the audited production-alias rule; put exact content moves in public/_redirects"
        }
      ];
}

import { canonicalOrigin, type SeoPage } from "./rules";

export const maxCrawlDepth = 3;

/** Follow rendered anchors between audited canonical pages, starting at home. */
export function auditLinkGraph(pages: Pick<SeoPage, "url" | "links">[]) {
  const edges = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const page of pages) {
    const path = new URL(page.url).pathname;
    edges.set(path, new Set());
    incoming.set(path, new Set());
  }
  for (const page of pages) {
    const source = new URL(page.url).pathname;
    for (const href of page.links) {
      try {
        const target = new URL(href, page.url);
        if (target.origin !== canonicalOrigin || target.pathname === source || !edges.has(target.pathname)) continue;
        edges.get(source)!.add(target.pathname);
        incoming.get(target.pathname)!.add(source);
      } catch {
        // Malformed links are not graph edges; HTTP/link checks run separately.
      }
    }
  }
  const depths = new Map<string, number>();
  const queue = edges.has("/") ? ["/"] : [];
  if (queue.length) depths.set("/", 0);
  for (let index = 0; index < queue.length; index++) {
    const source = queue[index];
    for (const target of edges.get(source)!) {
      if (depths.has(target)) continue;
      depths.set(target, depths.get(source)! + 1);
      queue.push(target);
    }
  }
  return {
    entryPath: "/",
    maxAllowedDepth: maxCrawlDepth,
    pages: [...edges.keys()].sort().map((path) => ({
      path,
      depth: depths.get(path) ?? null,
      incomingPaths: [...incoming.get(path)!].sort(),
      outgoingPaths: [...edges.get(path)!].sort()
    }))
  };
}

// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The module dependency graph is part of the architecture (docs/architecture.md). Lint blocks forbidden
 * DIRECTIONS; this guards the allowed graph itself: it must stay acyclic, and any new dependency between
 * features has to be added below on purpose, where a reviewer will see it.
 *
 * Layering, lowest first:
 *   shared/config -> features/github -> features/profile -> features/{cv, projects, telemetry, ...}
 *   -> components/ui -> components/layout, features/home -> app
 */
const ALLOWED: Record<string, string[]> = {
  "shared/config": [],
  "shared/edge": [],
  "shared/node": [],
  "features/github": ["shared/config"],
  "features/profile": ["features/github", "shared/config"],
  "features/telemetry": ["features/profile"],
  "features/cv": ["features/github", "features/profile"],
  "features/applications": ["features/cv", "features/profile"],
  "features/projects": ["components/ui", "features/github", "features/profile"],
  "features/marketing": ["features/github", "features/projects", "features/telemetry"],
  "features/insights": ["features/telemetry"],
  "features/tools": ["features/profile", "features/telemetry"],
  "features/jobs": [],
  "features/home": ["components/ui", "features/profile"],
  "components/ui": ["features/telemetry"],
  "components/layout": ["components/ui", "features/profile"],
  app: ["components/layout", "components/ui", "features/github", "features/home", "features/insights", "features/profile", "features/projects", "features/telemetry", "features/tools"]
};

/** What each deployable Worker may pull into its bundle. */
const WORKER_ALLOWED: Record<string, string[]> = {
  "job-review": ["features/jobs", "shared/edge"],
  "site-metrics": ["features/telemetry", "shared/edge"]
};

const SPEC = /(?:from\s+|import\s*\(\s*|import\s+)(["'])([^"'\n]+)\1/g;

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : walk(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function unitOf(path: string): string | null {
  const parts = path.split("/");
  if (parts[0] !== "src") return null;
  if (parts[1] === "features" || parts[1] === "shared" || parts[1] === "components") return `${parts[1]}/${parts[2]}`;
  return parts[1];
}

function resolve(spec: string, from: string, all: Set<string>): string | null {
  const base = spec.startsWith("@/") ? join("src", spec.slice(2)) : spec.startsWith(".") ? normalize(join(dirname(from), spec)) : null;
  if (!base) return null;
  return ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((extension) => base + extension).find((candidate) => all.has(candidate)) ?? null;
}

function buildGraph(roots: string[], unit: (path: string) => string | null) {
  const files = roots.flatMap((root) => walk(root));
  const all = new Set(files);
  const srcFiles = new Set(walk("src"));
  const edges = new Map<string, Set<string>>();
  for (const file of files) {
    const from = unit(file);
    if (!from) continue;
    for (const match of readFileSync(file, "utf8").matchAll(SPEC)) {
      const target = resolve(match[2], file, new Set([...all, ...srcFiles]));
      const to = target ? unitOf(target) : null;
      if (!to || to === from) continue;
      (edges.get(from) ?? edges.set(from, new Set()).get(from)!).add(to);
    }
  }
  return edges;
}

describe("src module graph", () => {
  const edges = buildGraph(["src"], unitOf);

  it("every source directory is a declared unit (no unowned code)", () => {
    const units = new Set(walk("src").map(unitOf));
    for (const unit of units) expect(Object.keys(ALLOWED), `${unit} is not declared in ALLOWED`).toContain(unit as string);
  });

  it("only declared dependencies exist", () => {
    for (const [from, targets] of edges) {
      const unexpected = [...targets].filter((target) => !(ALLOWED[from] ?? []).includes(target));
      expect(unexpected, `${from} gained undeclared dependencies`).toEqual([]);
    }
  });

  it("has no dependency cycles between units", () => {
    const cycles: string[][] = [];
    const visiting: string[] = [];
    const done = new Set<string>();
    const visit = (node: string) => {
      if (done.has(node)) return;
      const at = visiting.indexOf(node);
      if (at !== -1) { cycles.push([...visiting.slice(at), node]); return; }
      visiting.push(node);
      for (const next of edges.get(node) ?? []) visit(next);
      visiting.pop();
      done.add(node);
    };
    for (const node of Object.keys(ALLOWED)) visit(node);
    expect(cycles.map((cycle) => cycle.join(" -> "))).toEqual([]);
  });

  it("the declared graph itself is acyclic (so the allowance cannot hide a cycle)", () => {
    const state = new Map<string, number>();
    const visit = (node: string): boolean => {
      if (state.get(node) === 1) return true;
      if (state.get(node) === 2) return false;
      state.set(node, 1);
      const cyclic = (ALLOWED[node] ?? []).some(visit);
      state.set(node, 2);
      return cyclic;
    };
    expect(Object.keys(ALLOWED).filter(visit)).toEqual([]);
  });

  it("shared modules never depend on features, components or routes", () => {
    for (const unit of ["shared/config", "shared/edge", "shared/node"]) {
      expect([...(edges.get(unit) ?? [])].filter((target) => !target.startsWith("shared/")), unit).toEqual([]);
    }
  });

  it("the lowest layers stay Node-free and UI-free: github and profile depend on no component or route", () => {
    for (const unit of ["features/github", "features/profile", "features/cv", "features/jobs"]) {
      expect([...(edges.get(unit) ?? [])].filter((target) => target.startsWith("components/") || target === "app"), unit).toEqual([]);
    }
  });
});

describe("Worker bundles", () => {
  for (const [worker, allowed] of Object.entries(WORKER_ALLOWED)) {
    it(`${worker} pulls in only ${allowed.join(" and ")}`, () => {
      const files = walk(`workers/${worker}`);
      const all = new Set([...files, ...walk("src")]);
      const used = new Set<string>();
      for (const file of files) {
        for (const match of readFileSync(file, "utf8").matchAll(SPEC)) {
          const target = resolve(match[2], file, all);
          const unit = target ? unitOf(target) : null;
          if (unit) used.add(unit);
        }
      }
      expect([...used].filter((unit) => !allowed.includes(unit)), `${worker} imports outside its allowance`).toEqual([]);
      expect(used.size, `${worker} should use src code`).toBeGreaterThan(0);
    });
  }
});

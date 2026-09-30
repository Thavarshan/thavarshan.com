// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Workflows refer to repository paths in two easy-to-forget ways: trigger `paths:` filters and the test
 * paths handed to `vitest run`. Both go stale silently when files move: a stale filter stops a deploy from
 * triggering, and a stale test path fails the job ("no test files found") only the next time it runs.
 */
const workflowDirectory = ".github/workflows";
const workflows = readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name)).map((name) => ({ name, text: readFileSync(join(workflowDirectory, name), "utf8") }));

const looksLikePath = (value: string) => value.includes("/") && !/\s|^https?:|\$\{\{|\*\s/.test(value) && !/^[\d*/, -]+$/.test(value);

/** A filter like `src/features/jobs/**`, `workers/job-review/**` or `package-lock.json` must match something real. */
function matchesSomething(pattern: string): boolean {
  const literal = pattern.replace(/\/\*\*(\/\*)?$/, "").replace(/\*\*?$/, "");
  if (literal.includes("*")) {
    const directory = literal.slice(0, literal.lastIndexOf("/"));
    return existsSync(directory);
  }
  return existsSync(literal);
}

describe("workflow path references", () => {
  it.each(workflows)("$name: every trigger path filter still matches something", ({ text }) => {
    const filters = [...text.matchAll(/^\s+-\s+"([^"]+)"\s*$/gm)].map((match) => match[1]).filter(looksLikePath);
    const stale = filters.filter((filter) => !matchesSomething(filter));
    expect(stale, "stale path filters (the workflow would silently stop triggering on them)").toEqual([]);
  });

  it.each(workflows)("$name: every test path given to vitest exists", ({ text }) => {
    const commands = [...text.matchAll(/vitest run ([^\n]+)/g)].map((match) => match[1]);
    const paths = commands.flatMap((command) => command.split(/\s+/).filter((token) => token.startsWith("tests/")));
    const missing = paths.filter((path) => !existsSync(path) && readdirSafe(path.slice(0, path.lastIndexOf("/"))).every((entry) => !entry.startsWith(path.slice(path.lastIndexOf("/") + 1))));
    expect(missing, "vitest would exit with 'no test files found'").toEqual([]);
  });

  it("the filters and test paths it checks are actually present in the workflows (the test is not vacuous)", () => {
    const all = workflows.map((workflow) => workflow.text).join("\n");
    expect([...all.matchAll(/^\s+-\s+"([^"]+)"\s*$/gm)].map((match) => match[1]).filter(looksLikePath).length).toBeGreaterThan(20);
    expect([...all.matchAll(/vitest run tests\//g)].length).toBeGreaterThan(3);
  });

  it("would catch a stale filter and a stale test path", () => {
    expect(matchesSomething("src/lib/**")).toBe(false);
    expect(matchesSomething("src/features/jobs/**")).toBe(true);
    expect(matchesSomething("workers/job-review/**")).toBe(true);
    expect(existsSync("tests/unit/oss-marketing")).toBe(false);
    expect(existsSync("tests/unit/marketing")).toBe(true);
  });
});

function readdirSafe(directory: string): string[] {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

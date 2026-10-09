import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { listFiles } from "../structure/routes";
import { checkLifecycle, checkHostRedirectOwnership, checkPreviousLifecycle, lifecycleSchema, parseContentRedirects } from "./lifecycle";

export async function auditLifecycle(root = resolve("out")) {
  const lifecycle = lifecycleSchema.parse(JSON.parse(await readFile("data/url-lifecycle.json", "utf8")));
  const redirects = parseContentRedirects(await readFile(resolve(root, "_redirects"), "utf8"));
  const failures = [...checkLifecycle(lifecycle, redirects, await listFiles(root)), ...checkHostRedirectOwnership(await readFile("netlify.toml", "utf8"))];
  const base = process.env.LIFECYCLE_BASE_REVISION;
  if (base && !/^0{40}$/.test(base)) {
    if (!/^[a-f0-9]{40}$/.test(base)) throw new Error("Invalid lifecycle base revision");
    // ls-tree also fails if the expected base commit wasn't fetched. Do not silently skip history.
    const exists = execFileSync("git", ["ls-tree", "--name-only", base, "--", "data/url-lifecycle.json"], { encoding: "utf8" }).trim();
    const previous = exists
      ? lifecycleSchema.parse(JSON.parse(execFileSync("git", ["show", `${base}:data/url-lifecycle.json`], { encoding: "utf8" })))
      : { schemaVersion: 1 as const, pages: [], retired: [] };
    const previousRedirects = parseContentRedirects(execFileSync("git", ["show", `${base}:public/_redirects`], { encoding: "utf8" }));
    failures.push(...checkPreviousLifecycle(previous, lifecycle, redirects, previousRedirects));
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await auditLifecycle();
  for (const failure of failures) console.error(`${failure.url} [${failure.rule}] ${failure.detail}`);
  if (failures.length) process.exitCode = 1;
  else console.log("Concrete page register, retirement records and content redirect targets verified.");
}

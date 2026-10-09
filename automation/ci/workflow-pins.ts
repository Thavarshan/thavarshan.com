import { readdir, readFile } from "node:fs/promises";

export function unpinnedActions(text: string): string[] {
  return [...text.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+).*$/gm)]
    .map((match) => match[1])
    .filter((action) => !action.startsWith("./") && !/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(action));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of await readdir(".github/workflows")) {
    if (!/\.ya?ml$/.test(name)) continue;
    const failures = unpinnedActions(await readFile(`.github/workflows/${name}`, "utf8"));
    if (failures.length) {
      console.error(`${name}: unpinned actions: ${failures.join(", ")}`);
      process.exitCode = 1;
    }
  }
}

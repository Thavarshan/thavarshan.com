// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let child: ChildProcess;
let directory: string;
let origin: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "url-lifecycle-"));
  await Promise.all([
    writeFile(join(directory, "index.html"), "<h1>Home</h1>"),
    writeFile(join(directory, "new.html"), "<h1>New</h1>"),
    writeFile(join(directory, "old.html"), "<h1>Obsolete file</h1>"),
    writeFile(join(directory, "404.html"), '<meta name="robots" content="noindex"><h1>Not found</h1>'),
    writeFile(join(directory, "_redirects"), "/old /new 301!\n/external https://example.com/final 301!\n")
  ]);
  child = spawn(process.execPath, ["--import", "tsx", "automation/static-server.ts", directory, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  origin = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Static server startup timed out")), 10_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Static server exited before startup"));
    });
    child.stdout!.on("data", (chunk) => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });
});
afterAll(async () => {
  child?.kill();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("static server content lifecycle", () => {
  it("enforces a forced redirect even if the old HTML file exists, preserving query parameters", async () => {
    const response = await fetch(`${origin}/old?utm_source=test`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/new?utm_source=test");
    expect(await response.text()).not.toContain("Obsolete file");
  });
  it("serves the final destination directly and unknown/deleted paths as true 404s", async () => {
    expect((await fetch(`${origin}/new`, { redirect: "manual" })).status).toBe(200);
    const missing = await fetch(`${origin}/deleted`, { redirect: "manual" });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("noindex");
  });
  it("returns external destinations without fetching them", async () => {
    const response = await fetch(`${origin}/external`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com/final");
  });
});

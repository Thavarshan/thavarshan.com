import { mkdir, readFile, writeFile } from "node:fs/promises";
import { verifyCv } from "../cv/verify";
import { checkHeaders, checkHtml, checkRedirect, deploymentOrigin, revisionMatches, type DeploymentFailure, type DeploymentMode } from "./deployment-rules";

import { lifecycleSchema, parseContentRedirects } from "../seo/lifecycle";

async function main() {
  const mode: DeploymentMode = process.env.DEPLOYMENT_MODE === "preview" ? "preview" : "production";
  const origin = deploymentOrigin(process.env.DEPLOYMENT_URL || "https://thavarshan.com", mode);
  const expected = process.env.EXPECTED_REVISION || "";
  if (!/^[a-f0-9]{40}$/.test(expected)) throw new Error("EXPECTED_REVISION must be a full commit SHA");
  const failures: DeploymentFailure[] = [];
  await mkdir("test-results/deployment", { recursive: true });
  const request = (path: string) =>
    fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "cache-control": "no-cache" } });
  try {
    let current = false;
    // Bounded: 20 requests, 10 seconds each, with at most 19 fifteen-second gaps.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const response = await request("/build-info.json");
        if (response.status === 200 && revisionMatches(await response.json(), expected, mode)) {
          current = true;
          break;
        }
      } catch {
        /* A deployment may be temporarily unavailable while publishing. */
      }
      if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
    if (!current)
      failures.push({
        url: `${origin}/build-info.json`,
        rule: "deployed-revision",
        detail: `Expected ${expected} in ${mode}; deployment is stale, missing or unavailable`
      });
    else {
      for (const path of ["/", "/projects", "/tools", "/insights", "/cv"]) {
        const response = await request(path);
        const html = await response.text();
        failures.push(...checkHeaders(`${origin}${path}`, response.status, response.headers, mode), ...checkHtml(`${origin}${path}`, html, mode));
      }
      // Preview checks execute trusted main, whose content policy may differ from the PR.
      // The PR's rendered audit validates its own rules; use this policy only in production.
      if (mode === "production") {
        const lifecycle = lifecycleSchema.parse(JSON.parse(await readFile("data/url-lifecycle.json", "utf8")));
        const redirects = parseContentRedirects(await readFile("public/_redirects", "utf8"));
        for (const rule of redirects) {
          const response = await request(rule.from);
          failures.push(...checkRedirect(`${origin}${rule.from}`, response.status, response.headers.get("location"), new URL(rule.to, origin).href));
        }
        for (const retired of lifecycle.retired) {
          const response = await request(retired.path);
          failures.push(...checkHeaders(`${origin}${retired.path}`, response.status, response.headers, mode, "missing"));
        }
      }
      const missing = await request("/__ci_missing_page__");
      failures.push(...checkHeaders(`${origin}/__ci_missing_page__`, missing.status, missing.headers, mode, "missing"));
      const pdf = await request("/docs/Jerome-Resume.pdf");
      failures.push(...checkHeaders(`${origin}/docs/Jerome-Resume.pdf`, pdf.status, pdf.headers, mode, "pdf"));
      if (pdf.status === 200) {
        const path = "test-results/deployment/Jerome-Resume.pdf";
        await writeFile(path, new Uint8Array(await pdf.arrayBuffer()));
        try {
          await verifyCv(path);
        } catch {
          failures.push({
            url: `${origin}/docs/Jerome-Resume.pdf`,
            rule: "cv-content",
            detail: "Published PDF failed the name, phone, sections or page-count checks"
          });
        }
      }
      if (mode === "production") {
        for (const alias of ["https://www.thavarshan.com", "https://thavarshan.netlify.app"]) {
          const response = await fetch(`${alias}/projects`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
          failures.push(...checkRedirect(`${alias}/projects`, response.status, response.headers.get("location"), "https://thavarshan.com/projects"));
        }
      }
      const redirect = await request("/projects/");
      failures.push(...checkRedirect(`${origin}/projects/`, redirect.status, redirect.headers.get("location"), `${origin}/projects`));
    }
  } catch (error) {
    failures.push({ url: origin, rule: "request", detail: error instanceof Error ? error.message : "Deployment request failed" });
  } finally {
    await writeFile(
      "test-results/deployment/audit.json",
      JSON.stringify({ schemaVersion: 1, origin, expectedRevision: expected, mode, failures }, null, 2) + "\n"
    );
  }
  for (const failure of failures) console.error(`${failure.url} [${failure.rule}] ${failure.detail}`);
  if (failures.length) process.exitCode = 1;
  else console.log(`Verified ${mode} deployment ${expected} at ${origin}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { groqConfiguration } from "@automation/applications/groq-client";

/**
 * COST GUARD. This project must never incur infrastructure charges. Cloudflare's Free plans cannot
 * bill (over-limit requests fail instead), but adding a paid-only setting or product can. This test
 * uses an ALLOWLIST so anything not explicitly reviewed as free-safe fails CI, including things
 * that don't exist yet. To allow something new, prove it is free on the Workers Free plan and
 * document it in docs/adr/0001-cloudflare-worker-for-private-job-review.md.
 */
const configPaths = ["workers/job-review/wrangler.toml", "workers/site-metrics/wrangler.toml"];

function parse(toml: string) {
  const topLevelKeys: string[] = [];
  const sections: string[] = [];
  let inTop = true;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const header = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (header) {
      inTop = false;
      sections.push(header[1].trim());
      continue;
    }
    const key = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (key && inTop) topLevelKeys.push(key[1]);
  }
  return { topLevelKeys, sections };
}

describe.each(configPaths)("Worker config %s is free-plan safe (allowlist)", (configPath) => {
  const config = readFileSync(resolve(process.cwd(), configPath), "utf8");
  const { topLevelKeys, sections } = parse(config);

  it("uses only reviewed top-level settings", () => {
    const allowed = ["name", "main", "compatibility_date"];
    expect(topLevelKeys.filter((key) => !allowed.includes(key))).toEqual([]);
  });

  it("uses only reviewed sections: plain variables and one KV namespace", () => {
    const allowed = ["vars", "kv_namespaces"];
    expect(sections.filter((section) => !allowed.includes(section))).toEqual([]);
  });

  it("does not declare any paid-plan or usage-billed product, by name", () => {
    const forbidden = [
      "r2_buckets",
      "d1_databases",
      "durable_objects",
      "queues",
      "vectorize",
      "hyperdrive",
      "ai",
      "browser",
      "analytics_engine",
      "services",
      "dispatch_namespaces",
      "workflows",
      "containers",
      "images",
      "mtls_certificates",
      "unsafe",
      "limits",
      "cpu_ms",
      "usage_model",
      "placement",
      "logpush",
      "observability",
      "tail_consumers",
      "routes",
      "route",
      "triggers",
      "smart"
    ];
    const text = config.replace(/#.*$/gm, "");
    for (const name of forbidden) {
      expect(new RegExp(`^\\s*\\[{0,2}${name}\\b|^\\s*${name}\\s*=`, "m").test(text), `${name} is not allowed`).toBe(false);
    }
  });

  it("enables no compatibility flags (Workers must not depend on Node compatibility)", () => {
    expect(config).not.toMatch(/compatibility_flags/);
  });

  it("keeps the Worker on the default workers.dev hostname (no zone, routes or custom-domain products)", () => {
    expect(topLevelKeys).not.toContain("workers_dev");
    expect(config).not.toMatch(/custom_domain|zone_id|zone_name|pattern\s*=/);
  });
});

describe("deploy automation cannot switch anything to a paid path", () => {
  const workflows = ["job-review-deploy.yml", "job-review-preview.yml", "site-metrics-deploy.yml"]
    .map((name) => readFileSync(resolve(process.cwd(), ".github/workflows", name), "utf8"))
    .join("\n");

  it("only runs wrangler deploy / versions upload against the reviewed config", () => {
    const wranglerCalls = workflows.match(/wrangler\s+[a-z-]+(?:\s+[a-z-]+)?/g) ?? [];
    for (const call of wranglerCalls) expect(call).toMatch(/wrangler (deploy|versions upload)/);
    expect(workflows).toContain("--config workers/job-review/wrangler.toml");
    expect(workflows).toContain("--config workers/site-metrics/wrangler.toml");
  });

  it("never runs untrusted fork code with the deploy token, and previews are read-only", () => {
    const preview = readFileSync(resolve(process.cwd(), ".github/workflows/job-review-preview.yml"), "utf8");
    expect(preview).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(preview).toContain("--var READ_ONLY:1");
    expect(preview).not.toContain("wrangler deploy");
    expect(preview).not.toMatch(/pull_request_target/);
  });

  it("does not use paid-tier deploy flags", () => {
    expect(workflows).not.toMatch(/--minify=false|--upload-source-maps|--tail-consumer|--keep-vars=false/);
  });
});

describe("Groq AI has no paid inference path", () => {
  it("uses Groq credentials, explicit Free confirmation and scheduled AI", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/applications-refresh.yml"), "utf8");
    expect(workflow).toContain("GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}");
    expect(workflow).toContain("GROQ_FREE_PLAN_CONFIRMED: ${{ vars.GROQ_FREE_PLAN_CONFIRMED }}");
    expect(workflow).toContain("APPLICATIONS_MODE: ${{ inputs.mode || 'ai' }}");
    expect(workflow).not.toMatch(/OPENAI_API_KEY|ENABLE_PAID_AI|Secrets not configured/);
    expect(workflow).not.toMatch(/upload-artifact/);
  });

  it("requires exact Free confirmation and never uses legacy paid keys", () => {
    for (const value of [undefined, "", "1", "TRUE", "false"]) {
      expect(() => groqConfiguration({ GROQ_API_KEY: "synthetic", GROQ_FREE_PLAN_CONFIRMED: value })).toThrow();
    }
    expect(() => groqConfiguration({ OPENAI_API_KEY: "synthetic", ENABLE_PAID_AI: "true", GROQ_FREE_PLAN_CONFIRMED: "true" })).toThrow("GROQ_API_KEY");
    expect(groqConfiguration({ GROQ_API_KEY: "synthetic", GROQ_FREE_PLAN_CONFIRMED: "true" }).model).toBe("openai/gpt-oss-20b");
    expect(() => groqConfiguration({ GROQ_API_KEY: "synthetic", GROQ_FREE_PLAN_CONFIRMED: "true", GROQ_MODEL: "other" })).toThrow("Unsupported");
  });
});

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseAggregateKey } from "../../lib/telemetry/events";
import { buildSnapshot, daysBetween, isoWeekLabel, lastCompletedWeek, renderSnapshotSummary, snapshotSchema, type AggregateRow, type MetricsSnapshot, type Period } from "../../lib/telemetry/snapshot";
import { mapWithConcurrency, withRetry } from "../../lib/node/async";
import { writeJsonAtomic } from "../../lib/node/fs";

const outputDir = resolve("data/growth");
const API = "https://api.cloudflare.com/client/v4";
const REQUEST_TIMEOUT_MS = 15_000;
/** Hard bound on what one run will read, so a flood of junk keys can never make this unbounded. */
export const MAX_KEYS = 5_000;

interface Args {
  start?: string;
  end?: string;
  dryRun: boolean;
  inputFile?: string;
}

export function parseArgs(argv: string[]): Args {
  const value = (flag: string) => { const index = argv.indexOf(flag); return index === -1 ? undefined : argv[index + 1]; };
  const date = (flag: string) => {
    const raw = value(flag);
    if (raw !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${flag} must be YYYY-MM-DD`);
    return raw;
  };
  const args = { start: date("--start"), end: date("--end"), dryRun: argv.includes("--dry-run"), inputFile: value("--input") };
  if ((args.start === undefined) !== (args.end === undefined)) throw new Error("--start and --end must be used together");
  if (args.start && args.end && args.start > args.end) throw new Error("--start must not be after --end");
  return args;
}

export function periodFor(args: Args, now: Date): Period {
  if (args.start && args.end) return { start: args.start, end: args.end, isoWeek: isoWeekLabel(new Date(args.start)) };
  return lastCompletedWeek(now);
}

async function namespaceId(): Promise<string> {
  const toml = await readFile(resolve("workers/site-metrics/wrangler.toml"), "utf8");
  const match = toml.match(/binding\s*=\s*"METRICS_KV"\s*\r?\nid\s*=\s*"([0-9a-f]{32})"/);
  if (!match) throw new Error("Could not find the METRICS_KV namespace id in workers/site-metrics/wrangler.toml");
  return match[1];
}

async function cloudflare(path: string, token: string, asText = false): Promise<unknown> {
  return withRetry(
    async () => {
      const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (response.status === 404 && asText) return null;
      if (!response.ok) throw new Error(`Cloudflare API ${response.status} for ${path.split("?")[0].replace(/[0-9a-f]{32}/g, "…")}`);
      return asText ? response.text() : response.json();
    },
    { retries: 2, baseDelayMs: 500, isRetryable: () => true }
  );
}

export async function readRowsFromKv(period: Period, credentials: { token: string; accountId: string }): Promise<AggregateRow[]> {
  const namespace = await namespaceId();
  const base = `/accounts/${credentials.accountId}/storage/kv/namespaces/${namespace}`;
  const keys: string[] = [];

  for (const day of daysBetween(period.start, period.end)) {
    let cursor = "";
    do {
      const query = new URLSearchParams({ prefix: `m|${day}|`, limit: "1000", ...(cursor ? { cursor } : {}) });
      const page = (await cloudflare(`${base}/keys?${query}`, credentials.token)) as { result?: Array<{ name: string }>; result_info?: { cursor?: string } };
      for (const item of page.result ?? []) keys.push(item.name);
      cursor = page.result_info?.cursor ?? "";
      if (keys.length > MAX_KEYS) throw new Error(`Refusing to read more than ${MAX_KEYS} keys (found ${keys.length}); the collector may be under abuse.`);
    } while (cursor);
  }

  const rows: AggregateRow[] = [];
  const results = await mapWithConcurrency(keys, 5, async (key) => {
    const text = (await cloudflare(`${base}/values/${encodeURIComponent(key)}`, credentials.token, true)) as string | null;
    const parsed = parseAggregateKey(key);
    const count = Number(text);
    // Anything that is not a well-formed key with a sane count is ignored, never trusted.
    if (!parsed || !Number.isInteger(count) || count < 0 || count > 1_000_000) return null;
    return { ...parsed, count } satisfies AggregateRow;
  });
  for (const result of results) if (result.status === "fulfilled" && result.value) rows.push(result.value);
  return rows;
}

async function readPrevious(period: Period): Promise<MetricsSnapshot | null> {
  const previousWeek = isoWeekLabel(new Date(Date.parse(period.start) - 7 * 86_400_000));
  try {
    return snapshotSchema.parse(JSON.parse(await readFile(resolve(outputDir, `${previousWeek}.json`), "utf8")));
  } catch {
    return null;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const now = new Date();
  const period = periodFor(args, now);

  let rows: AggregateRow[];
  if (args.inputFile) {
    rows = JSON.parse(await readFile(resolve(args.inputFile), "utf8")) as AggregateRow[];
  } else {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!token || !accountId) {
      console.log("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are not set; skipping the metrics snapshot (no cost, nothing written).");
      return;
    }
    rows = await readRowsFromKv(period, { token, accountId });
  }

  const snapshot = snapshotSchema.parse(buildSnapshot(rows, period, now.toISOString(), await readPrevious(period)));
  const summary = renderSnapshotSummary(snapshot);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
  if (args.dryRun) return;

  await mkdir(outputDir, { recursive: true });
  await writeJsonAtomic(resolve(outputDir, `${period.isoWeek}.json`), snapshot);
  await writeJsonAtomic(resolve(outputDir, "latest.json"), snapshot);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

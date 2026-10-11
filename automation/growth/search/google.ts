import { createSign } from "node:crypto";
import { z } from "zod";
import { metricsSchema, origin, pageUrl, searchPolicy, searchSnapshotSchema, type SearchSnapshot } from "./model";

const tokenUrl = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/webmasters.readonly";
const credentialsSchema = z.object({
  type: z.literal("service_account"),
  client_email: z
    .string()
    .email()
    .regex(/\.iam\.gserviceaccount\.com$/),
  private_key: z.string().min(100).max(10000),
  token_uri: z.literal(tokenUrl).optional()
});
const rowSchema = z.object({
  keys: z.array(z.string().max(500)).optional(),
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().nonnegative()
});
const responseSchema = z.object({ rows: z.array(rowSchema).max(searchPolicy.maxRows).default([]), responseAggregationType: z.enum(["byProperty", "byPage"]) });

/** Bounded response parsing. Never return provider error bodies or credential fields. */
export async function postGoogle(url: string, body: string, headers: Record<string, string>, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (
    url !== tokenUrl &&
    ![`${origin}/`, "sc-domain:thavarshan.com"].some(
      (property) => url === `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`
    )
  )
    throw new Error("Unapproved search endpoint");
  const response = await fetcher(url, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(10000) });
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error("Search API request failed; check authentication, access and quotas");
  }
  const reader = response.body.getReader();
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > searchPolicy.maxBytes) throw new Error("Search response exceeds limit");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export function comparisonPeriods(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid search timestamp");
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const today = Date.parse(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  const day = (offset: number) => new Date(today - offset * 86400000).toISOString().slice(0, 10);
  // Exclude three most recent Pacific days and ask Google for finalized data only.
  return { current: { start: day(30), end: day(3) }, previous: { start: day(58), end: day(31) } };
}

export async function collectGoogleSearch(
  credentialsJson: string,
  property = `${origin}/`,
  now = new Date(),
  fetcher: typeof fetch = fetch
): Promise<SearchSnapshot> {
  if (![`${origin}/`, "sc-domain:thavarshan.com"].includes(property)) throw new Error("Unexpected Search Console property");
  const credentials = credentialsSchema.parse(JSON.parse(credentialsJson));
  const issued = Math.floor(now.getTime() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: credentials.client_email, scope, aud: tokenUrl, iat: issued, exp: issued + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(payload).sign(credentials.private_key, "base64url");
  const token = z
    .object({ access_token: z.string().min(1).max(4096), token_type: z.literal("Bearer") })
    .parse(
      await postGoogle(
        tokenUrl,
        new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${payload}.${signature}` }).toString(),
        { "content-type": "application/x-www-form-urlencoded" },
        fetcher
      )
    );
  const dates = comparisonPeriods(now);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const period = async (range: { start: string; end: string }) => {
    const query = async (dimensions: string[], aggregationType: "byProperty" | "byPage") => {
      const result = responseSchema.parse(
        await postGoogle(
          url,
          JSON.stringify({
            startDate: range.start,
            endDate: range.end,
            type: "web",
            dimensions,
            aggregationType,
            dataState: "final",
            rowLimit: dimensions.length ? searchPolicy.maxRows : 1,
            startRow: 0
          }),
          { "content-type": "application/json", authorization: `Bearer ${token.access_token}` },
          fetcher
        )
      );
      if (
        result.responseAggregationType !== aggregationType ||
        result.rows.some((row) => (row.keys?.length ?? 0) !== dimensions.length) ||
        (!dimensions.length && result.rows.length > 1)
      )
        throw new Error("Unexpected search aggregation");
      return result.rows;
    };
    const totals = await query([], "byProperty");
    const pages = await query(["page"], "byPage");
    const queries = await query(["page", "query"], "byPage");
    const metrics = (row: z.infer<typeof rowSchema>) => {
      const expectedCtr = row.impressions ? row.clicks / row.impressions : 0;
      if (Math.abs(expectedCtr - row.ctr) > 0.00001) throw new Error("Inconsistent search metrics");
      return metricsSchema.parse({ clicks: row.clicks, impressions: row.impressions, position: row.impressions ? row.position : null });
    };
    // Filter alias/query-string URLs from Domain properties; page/query analysis is canonical-only.
    const canonical = (page: string) => pageUrl.safeParse(page).success;
    return {
      ...range,
      totals: totals[0] ? metrics(totals[0]) : null,
      pages: pages.filter((row) => canonical(row.keys![0])).map((row) => ({ page: row.keys![0], metrics: metrics(row) })),
      queries: queries.filter((row) => canonical(row.keys![0])).map((row) => ({ page: row.keys![0], query: row.keys![1], metrics: metrics(row) }))
    };
  };
  // Six sequential analytics requests plus one token exchange; no unbounded paging/retries.
  const current = await period(dates.current);
  const previous = await period(dates.previous);
  return searchSnapshotSchema.parse({
    schemaVersion: 1,
    source: "google",
    property,
    collectedAt: now.toISOString(),
    searchType: "web",
    filters: { country: "all", device: "all" },
    timezone: "America/Los_Angeles",
    coverage: "partial-top-rows",
    current,
    previous
  });
}

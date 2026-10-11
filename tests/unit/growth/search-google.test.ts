// @vitest-environment node
import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { collectGoogleSearch, comparisonPeriods, postGoogle } from "../../../automation/growth/search/google";
import { searchPolicy } from "../../../automation/growth/search/model";

const now = new Date("2026-10-11T01:00:00Z");
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const credentials = JSON.stringify({
  type: "service_account",
  client_email: "search@test.iam.gserviceaccount.com",
  private_key: keys.privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.googleapis.com/token"
});
const get = () =>
  vi.fn<typeof fetch>(async (url, options) => {
    if (String(url).endsWith("/token")) return Response.json({ access_token: "ACCESS_SENTINEL", token_type: "Bearer" });
    const body = JSON.parse(options!.body as string);
    const dimensions = body.dimensions as string[];
    const keys =
      dimensions.length === 2
        ? ["https://thavarshan.com/tools/laravel-env-checker", "laravel env checker"]
        : dimensions.length
          ? ["https://thavarshan.com/tools/laravel-env-checker"]
          : [];
    return Response.json({ rows: [{ keys, clicks: 2, impressions: 200, ctr: 0.01, position: 12 }], responseAggregationType: body.aggregationType });
  });

describe("bounded read-only Google search API", () => {
  it("uses Pacific dates and two matched complete 28-day windows", () => {
    expect(comparisonPeriods(now)).toEqual({ current: { start: "2026-09-10", end: "2026-10-07" }, previous: { start: "2026-08-13", end: "2026-09-09" } });
  });
  it("signs a read-only JWT and performs exactly six analytics requests", async () => {
    const fetcher = get();
    const result = await collectGoogleSearch(credentials, undefined, now, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(result.source).toBe("google");
    const assertion = new URLSearchParams(fetcher.mock.calls[0][1]!.body as string).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    const parsed = JSON.parse(Buffer.from(claims, "base64url").toString());
    expect(parsed.scope).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(parsed.exp - parsed.iat).toBe(3600);
    expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(keys.publicKey, signature, "base64url")).toBe(true);
    for (const [url, options] of fetcher.mock.calls.slice(1)) {
      expect(String(url)).toContain("https%3A%2F%2Fthavarshan.com%2F");
      expect(options?.redirect).toBe("manual");
      const body = JSON.parse(options!.body as string);
      expect(body.dataState).toBe("final");
      expect(body.type).toBe("web");
      expect(body.startRow).toBe(0);
      expect(options!.headers).toMatchObject({ authorization: "Bearer ACCESS_SENTINEL" });
    }
    expect(JSON.stringify(result)).not.toContain("ACCESS_SENTINEL");
  });
  it.each([401, 403, 429, 302, 500])("fails visibly on HTTP %s without exposing the response body", async (status) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("PRIVATE_PROVIDER_ERROR", { status }));
    await expect(collectGoogleSearch(credentials, undefined, now, fetcher)).rejects.toThrow("Search API request failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not send credentials to unexpected properties or token destinations", async () => {
    const fetcher = get();
    await expect(collectGoogleSearch(credentials, "https://example.com/", now, fetcher)).rejects.toThrow();
    await expect(
      collectGoogleSearch(JSON.stringify({ ...JSON.parse(credentials), token_uri: "https://example.com/token" }), undefined, now, fetcher)
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects incorrect aggregation and malformed/oversized responses", async () => {
    const fetcher = get();
    fetcher
      .mockImplementationOnce(async () => Response.json({ access_token: "TOKEN", token_type: "Bearer" }))
      .mockImplementationOnce(async () => Response.json({ rows: [], responseAggregationType: "byPage" }));
    await expect(collectGoogleSearch(credentials, undefined, now, fetcher)).rejects.toThrow("Unexpected search aggregation");
    await expect(postGoogle("https://oauth2.googleapis.com/token", "", {}, async () => new Response("x".repeat(searchPolicy.maxBytes + 1)))).rejects.toThrow(
      "exceeds limit"
    );
    await expect(postGoogle("https://oauth2.googleapis.com/token", "", {}, async () => new Response("not JSON"))).rejects.toThrow();
  });
  it("keeps empty aggregate responses unknown instead of inventing zero traffic", async () => {
    const fetcher = get();
    fetcher.mockImplementation(async (url, options) =>
      String(url).endsWith("/token")
        ? Response.json({ access_token: "TOKEN", token_type: "Bearer" })
        : Response.json({ responseAggregationType: JSON.parse(options!.body as string).aggregationType })
    );
    const result = await collectGoogleSearch(credentials, undefined, now, fetcher);
    expect(result.current.totals).toBeNull();
    expect(result.current.queries).toEqual([]);
  });
  it("filters legacy Domain-property URLs with the same canonical contract as the report", async () => {
    const fetcher = get();
    fetcher.mockImplementation(async (url, options) => {
      if (String(url).endsWith("/token")) return Response.json({ access_token: "TOKEN", token_type: "Bearer" });
      const body = JSON.parse(options!.body as string);
      const pages = [
        "https://thavarshan.com/",
        "https://thavarshan.com/cv",
        "https://thavarshan.com/old/",
        "https://thavarshan.com/old.html",
        "https://thavarshan.com/Old",
        "https://www.thavarshan.com/",
        "https://thavarshan.com/cv?source=old"
      ];
      const rows = body.dimensions.length
        ? pages.map((page) => ({ keys: body.dimensions.length === 2 ? [page, "example query"] : [page], clicks: 2, impressions: 200, ctr: 0.01, position: 12 }))
        : [{ keys: [], clicks: 14, impressions: 1400, ctr: 0.01, position: 12 }];
      return Response.json({ rows, responseAggregationType: body.aggregationType });
    });
    const result = await collectGoogleSearch(credentials, "sc-domain:thavarshan.com", now, fetcher);
    for (const period of [result.current, result.previous]) {
      expect(period.pages.map((row) => row.page)).toEqual(["https://thavarshan.com/", "https://thavarshan.com/cv"]);
      expect(period.queries.map((row) => row.page)).toEqual(["https://thavarshan.com/", "https://thavarshan.com/cv"]);
      expect(period.totals?.clicks).toBe(14);
    }
  });
});

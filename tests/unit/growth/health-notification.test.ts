import { describe, expect, it, vi } from "vitest";
import { notificationBody, notifyReport, reportFeed, type NotificationContext } from "../../../automation/growth/health/notify";

const summary = "# Growth Engine health: watch\n\nActive: 7; high-fit: 3. Private prepared/applied counts unavailable.\n";
const context: NotificationContext = {
  repository: "Thavarshan/thavarshan.com",
  ref: "refs/heads/main",
  event: "schedule",
  runId: 123,
  revision: "a".repeat(40),
  token: "PRIVATE_TOKEN"
};
const feed = { state: "open", body: reportFeed.marker, user: { login: reportFeed.owner } };
const comment = (body: string, login = "github-actions[bot]", id = 42) => ({ id, body, user: { login } });
const marker = "<!-- growth-health-delivery:123 -->";
const fixture = (pages: unknown[][] = [[]], issue: unknown = feed) =>
  vi.fn<typeof fetch>(async (url, options) => {
    if (options?.method === "POST") return Response.json({ id: 99, user: { login: "github-actions[bot]" } }, { status: 201 });
    if (String(url).includes("/comments?")) return Response.json(pages[Number(new URL(String(url)).searchParams.get("page")) - 1] ?? []);
    return Response.json(issue);
  });

describe("free GitHub report notification", () => {
  it("posts the public report once to the fixed feed with only the verified owner mentioned", async () => {
    const get = fixture();
    const result = await notifyReport(summary, context, get);
    expect(result.status).toBe("published");
    expect(result.url).toMatch(/#issuecomment-99$/);
    const [url, options] = get.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(url).toBe(`https://api.github.com/repos/Thavarshan/thavarshan.com/issues/${reportFeed.issue}/comments`);
    const body = JSON.parse(options!.body as string).body;
    expect(body).toContain(summary.trim());
    expect(body.match(/@[A-Za-z0-9-]+/g)).toEqual(["@Thavarshan"]);
    expect(body).toContain(marker);
    expect(body).toContain("/actions/runs/123");
    expect(body).not.toContain("PRIVATE_TOKEN");
    for (const [, options] of get.mock.calls) expect(options?.redirect).toBe("manual");
  });
  it("does not repeat a notification on job or workflow retry", async () => {
    const get = fixture([[comment(marker + "\nExisting report")]]);
    expect((await notifyReport(summary, context, get)).status).toBe("already-published");
    expect(get.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
  it("checks subsequent pages rather than assuming the first 100 comments prove absence", async () => {
    const get = fixture([Array.from({ length: 100 }, (_, i) => comment("Discussion", "someone", i + 1)), [comment(marker)]]);
    expect((await notifyReport(summary, context, get)).status).toBe("already-published");
    expect(get).toHaveBeenCalledTimes(3);
  });
  it("ignores forged delivery markers from other commenters", async () => {
    const get = fixture([[comment(marker, "someone")]]);
    expect((await notifyReport(summary, context, get)).status).toBe("published");
  });
  it("sends a bootstrap on first push and suppresses later code-push notifications", async () => {
    expect((await notifyReport(summary, { ...context, event: "push" }, fixture())).status).toBe("published");
    const get = fixture([[comment("<!-- growth-health-delivery:122 -->\nOlder report")]]);
    expect((await notifyReport(summary, { ...context, event: "push" }, get)).status).toBe("push-suppressed");
    expect(get.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    expect((await notifyReport(summary, context, fixture([[comment("<!-- growth-health-delivery:122 -->")]]))).status).toBe("published");
  });
  it("honours closing the feed without removing the report", async () => {
    const get = fixture([], { ...feed, state: "closed" });
    expect((await notifyReport(summary, context, get)).status).toBe("disabled");
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("rejects wrong destination, PRs and untrusted execution before posting", async () => {
    for (const issue of [
      { ...feed, body: "other issue" },
      { ...feed, user: { login: "someone" } },
      { ...feed, pull_request: { url: "https://github.com" } }
    ]) {
      const get = fixture([], issue);
      await expect(notifyReport(summary, context, get)).rejects.toThrow();
      expect(get.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    }
    for (const change of [{ ref: "refs/heads/feature" }, { repository: "other/private" }, { event: "pull_request" }, { token: "" }]) {
      const get = fixture();
      await expect(notifyReport(summary, { ...context, ...change } as NotificationContext, get)).rejects.toThrow();
      expect(get).not.toHaveBeenCalled();
    }
  });
  it("rejects untrusted summary mentions and oversized or malformed content", () => {
    for (const content of ["not a health report", summary + "@someone", summary + "x".repeat(60_000)])
      expect(() => notificationBody(content, context)).toThrow();
    expect(() => notificationBody(summary, { runId: -1, revision: "secret" })).toThrow();
  });
  it("fails safely for malformed, redirected, oversized or unavailable API responses", async () => {
    for (const response of [
      Response.json({ invalid: true }),
      new Response("PRIVATE_TOKEN", { status: 403 }),
      new Response("", { status: 302 }),
      new Response("x".repeat(2 * 1024 * 1024 + 1))
    ]) {
      const get = vi.fn<typeof fetch>(async () => response);
      await expect(notifyReport(summary, context, get)).rejects.toThrow();
      expect(get.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    }
  });
  it("does not leak a failed POST response or blindly retry a possibly accepted send", async () => {
    const get = fixture();
    get.mockImplementationOnce(async () => Response.json(feed));
    get.mockImplementationOnce(async () => Response.json([]));
    get.mockImplementationOnce(async () => new Response("PRIVATE_TOKEN", { status: 500 }));
    await expect(notifyReport(summary, context, get)).rejects.toThrow("GitHub notification request failed");
    expect(get.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });
  it("refuses to append after reaching the bounded history limit", async () => {
    const get = fixture(Array.from({ length: 10 }, () => Array.from({ length: 100 }, (_, i) => comment("discussion", "someone", i + 1))));
    await expect(notifyReport(summary, context, get)).rejects.toThrow("bounded scan");
    expect(get).toHaveBeenCalledTimes(11);
    expect(get.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
});

// @vitest-environment node
import { createServer, type Server } from "node:http";
import { request } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HostThrottle, RobotsDisallowedError, createPoliteRequest } from "@automation/jobs/http";
import { createRobotsGuard } from "@automation/jobs/robots";

// Synthetic local-only servers: one allowed board and one robots-disallowed destination.
describe("real GET redirect guard", () => {
  const requests: Record<string, number> = {};
  const count = (path: string) => (requests[path] = (requests[path] ?? 0) + 1);
  let board: Server;
  let employer: Server;
  let boardUrl = "";
  let employerUrl = "";
  let api: Awaited<ReturnType<typeof request.newContext>>;

  async function listen(server: Server): Promise<string> {
    await new Promise<void>((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Missing TCP server address");
    return `http://127.0.0.1:${addr.port}`;
  }

  beforeAll(async () => {
    employer = createServer((req, res) => {
      count(`employer:${req.method}:${req.url}`);
      if (req.url === "/robots.txt") res.end("User-agent: *\nDisallow: /private\n");
      else res.end("private posting");
    });
    employerUrl = await listen(employer);
    board = createServer((req, res) => {
      count(`board:${req.method}:${req.url}`);
      if (req.url === "/robots.txt") return res.end("User-agent: *\nAllow: /\n");
      if (req.url === "/different-by-method") {
        if (req.method === "HEAD") return res.end();
        res.writeHead(302, { Location: `${employerUrl}/private` });
        return res.end();
      }
      if (req.url === "/same-host") {
        res.writeHead(302, { Location: "/final" });
        return res.end();
      }
      if (req.url === "/loop") {
        res.writeHead(302, { Location: "/loop" });
        return res.end();
      }
      return res.end("public posting");
    });
    boardUrl = await listen(board);
    api = await request.newContext();
  });

  afterAll(async () => {
    await api?.dispose();
    await Promise.all([board, employer].filter(Boolean).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  it("never sends the forbidden content GET even when an allowed HEAD returns 200", async () => {
    const guard = createRobotsGuard(async (url) => {
      const response = await api.get(url, { maxRedirects: 0 });
      return { status: response.status(), text: () => response.text() };
    }, "JeromeJobCollector");
    const polite = createPoliteRequest({ request: api, guard, throttle: new HostThrottle(0), source: "larajobs" });
    expect((await api.head(`${boardUrl}/different-by-method`, { maxRedirects: 0 })).status()).toBe(200);
    await expect(polite.get(`${boardUrl}/different-by-method`)).rejects.toThrow(RobotsDisallowedError);
    expect(requests["employer:GET:/private"] ?? 0).toBe(0);
    expect(requests["employer:GET:/robots.txt"]).toBe(1);
  });

  it("allows checked same-host redirects and bounds redirect loops", async () => {
    const guard = { isAllowed: async () => true };
    const polite = createPoliteRequest({ request: api, guard, throttle: new HostThrottle(0), source: "larajobs" });
    expect((await polite.get(`${boardUrl}/same-host`)).status()).toBe(200);
    expect(requests["board:GET:/final"]).toBe(1);
    await expect(polite.get(`${boardUrl}/loop`)).rejects.toThrow(/too many redirects/i);
    expect(requests["board:GET:/loop"]).toBe(6);
  });
});

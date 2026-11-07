import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";
import { HostThrottle, navigateChecked } from "../../automation/jobs/http";
import { createRobotsGuard } from "../../automation/jobs/robots";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local server address");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("blocks an actual browser GET redirect to a robots-disallowed location", async ({ page }) => {
  let forbiddenGets = 0;
  const employer = createServer((request, response) => {
    if (request.url === "/robots.txt") return response.end("User-agent: *\nDisallow: /private\n");
    forbiddenGets++;
    return response.end("forbidden content");
  });
  const employerUrl = await listen(employer);
  const board = createServer((request, response) => {
    if (request.url === "/robots.txt") return response.end("User-agent: *\nAllow: /\n");
    if (request.method === "HEAD") return response.end();
    response.writeHead(302, { Location: `${employerUrl}/private` });
    return response.end();
  });

  try {
    const boardUrl = await listen(board);
    const guard = createRobotsGuard(async (url) => {
      const response = await page.context().request.get(url, { maxRedirects: 0 });
      return { status: response.status(), text: () => response.text() };
    }, "JeromeJobCollector");
    const start = `${boardUrl}/job`;
    expect((await page.context().request.head(start, { maxRedirects: 0 })).status()).toBe(200);
    await expect(navigateChecked(page, start, { guard, throttle: new HostThrottle(0) })).rejects.toThrow(/robots.txt/);
    expect(forbiddenGets).toBe(0);
  } finally {
    await close(board);
    await close(employer);
  }
});

test("renders an allowed redirected document and retains its final URL", async ({ page }) => {
  const employer = createServer((request, response) => {
    if (request.url === "/robots.txt") return response.end("User-agent: *\nAllow: /\n");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.end("<html><body><h1>Permitted job posting</h1></body></html>");
  });
  const employerUrl = await listen(employer);
  const board = createServer((request, response) => {
    if (request.url === "/robots.txt") return response.end("User-agent: *\nAllow: /\n");
    response.writeHead(302, { Location: `${employerUrl}/job` });
    return response.end();
  });

  try {
    const boardUrl = await listen(board);
    const guard = createRobotsGuard(async (url) => {
      const response = await page.context().request.get(url, { maxRedirects: 0 });
      return { status: response.status(), text: () => response.text() };
    }, "JeromeJobCollector");
    expect(await navigateChecked(page, `${boardUrl}/redirect`, { guard, throttle: new HostThrottle(0) })).toBe(`${employerUrl}/job`);
    await expect(page.getByRole("heading", { name: "Permitted job posting" })).toBeVisible();
  } finally {
    await close(board);
    await close(employer);
  }
});

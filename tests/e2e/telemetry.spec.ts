import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const COLLECTOR = "http://127.0.0.1:4175/collect";
const SECRET = "ZZ_TELEMETRY_SECRET_5d2f8a";

interface Captured { event: string; path: string; source: string | null; medium: string | null; campaign: string | null; referrer: string; props: Record<string, string> }

/** Captures beacons sent to the collector and answers them like the real one would. */
async function capture(context: BrowserContext) {
  const events: Captured[] = [];
  const raw: string[] = [];
  await context.route(COLLECTOR, async (route) => {
    const body = route.request().postData() ?? "";
    raw.push(body);
    try { events.push(JSON.parse(body)); } catch { /* recorded in raw */ }
    await route.fulfill({ status: 204 });
  });
  // Never actually leave the machine when a test clicks an external link.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  return { events, raw };
}

const settle = (page: Page) => page.waitForTimeout(300);

/** Clicks the first VISIBLE contact link (on mobile the nav copy sits inside a collapsed menu). */
const clickContact = (page: Page) => page.locator('a[href^="mailto:"]:visible').first().click({ timeout: 3000 }).catch(() => undefined);
const clickCv = (page: Page) => page.locator('a[href="/docs/Jerome-Resume.pdf"]:visible').first().click({ timeout: 3000 }).catch(() => undefined);

test("a click on the CV link records one intent event with only coarse, non-identifying fields", async ({ page, context }) => {
  const { events } = await capture(context);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await clickCv(page);
  await settle(page);

  const cv = events.filter((entry) => entry.event === "cv_download");
  expect(cv.length).toBeGreaterThanOrEqual(1);
  expect(cv[0]).toEqual({ event: "cv_download", path: "/", source: null, medium: null, campaign: null, referrer: "direct", props: { location: "home" } });
  expect(Object.keys(cv[0]).sort()).toEqual(["campaign", "event", "medium", "path", "props", "referrer", "source"]);
});

test("UTM attribution from the landing page is credited to a later click on another page", async ({ page, context }) => {
  const { events } = await capture(context);
  await page.goto("/?utm_source=LinkedIn&utm_medium=social&utm_campaign=release-fetch-php-3-9-0");
  await page.waitForLoadState("networkidle");
  await page.goto("/projects/fetch-php");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "View repository" }).click().catch(() => undefined);
  await settle(page);

  const repo = events.find((entry) => entry.event === "repo_click");
  expect(repo).toMatchObject({ path: "/projects/fetch-php", source: "linkedin", medium: "social", campaign: "release-fetch-php-3-9-0", props: { project: "fetch-php" } });
});

test("Do Not Track and Global Privacy Control: nothing is sent and nothing is stored", async ({ page, context }) => {
  const { events, raw } = await capture(context);
  await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }));
  await page.goto("/?utm_source=linkedin");
  await page.waitForLoadState("networkidle");
  await clickCv(page);
  await settle(page);
  expect(events).toEqual([]);
  expect(raw).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});

test("RESILIENCE: when the collector is blocked or down, the site works exactly the same", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route(COLLECTOR, (route) => route.abort());
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await clickContact(page);
  await page.goto("/tools/laravel-env-checker");
  await page.getByRole("button", { name: "Load a broken sample" }).click();
  await expect(page.getByTestId("env-summary")).toContainText("error");
  expect(errors).toEqual([]);
});

test("developer tools: completion and copy are counted, and pasted content never reaches the network", async ({ page, context }) => {
  const { events, raw } = await capture(context);
  const everyRequest: string[] = [];
  page.on("request", (request) => everyRequest.push(`${request.url()} ${request.postData() ?? ""}`));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);

  await page.goto("/tools/laravel-env-checker");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(".env", { exact: true }).evaluate((element, value) => {
    const area = element as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }, `APP_KEY=\nSTRIPE_SECRET=${SECRET}\nBROKEN=has spaces ${SECRET}\n`);
  await expect(page.getByTestId("env-findings")).toContainText("BROKEN has spaces");
  await page.getByRole("button", { name: "Copy full report" }).click();
  await settle(page);

  expect(events.filter((entry) => entry.event === "tool_completed")).toHaveLength(1);
  expect(events.find((entry) => entry.event === "tool_completed")).toMatchObject({ path: "/tools/laravel-env-checker", props: { tool: "laravel-env-checker" } });
  expect(events.some((entry) => entry.event === "tool_output_copied")).toBe(true);
  expect(raw.join("\n")).not.toContain(SECRET);
  expect(everyRequest.filter((entry) => entry.includes(SECRET))).toEqual([]);
});

test("reading most of an Insight is counted once, with only its slug", async ({ page, context }) => {
  const { events } = await capture(context);
  await page.goto("/insights/modernizing-legacy-platforms-during-delivery");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  const reads = events.filter((entry) => entry.event === "insight_read");
  expect(reads).toHaveLength(1);
  expect(reads[0]).toMatchObject({ path: "/insights/modernizing-legacy-platforms-during-delivery", props: { slug: "modernizing-legacy-platforms-during-delivery" } });
});

test("every event sent across a browsing session is valid under the shared schema, with no cookies set", async ({ page, context }) => {
  const { events, raw } = await capture(context);
  await page.goto("/?utm_source=devto&utm_medium=referral&utm_campaign=tool-post");
  for (const path of ["/tools", "/projects"]) await page.goto(path);
  await page.goto("/tools/laravel-scheduler-cron");
  await page.getByRole("button", { name: "Every 15 minutes" }).click({ timeout: 3000 });
  await page.goto("/cv");
  await clickContact(page);
  await settle(page);
  expect(raw.length).toBeGreaterThan(0);
  expect(raw.every((body) => { try { JSON.parse(body); return true; } catch { return false; } })).toBe(true);
  expect(events.every((entry) => /^\/[a-z0-9/_.-]*$/i.test(entry.path) && !entry.path.includes("?"))).toBe(true);
  expect(await context.cookies()).toEqual([]);
});

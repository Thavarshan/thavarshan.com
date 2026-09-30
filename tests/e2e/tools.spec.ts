import { expect, test, type Page } from "@playwright/test";

const SECRET = "ZZ_E2E_SECRET_VALUE_7f3a9c1d5e";

/** Sets a textarea the way a paste does. Playwright's fill() types large multi-line text as one editing step per line in Chromium, which is quadratic and unrepresentative. */
async function paste(page: Page, label: string | RegExp, text: string, exact = false) {
  await page.getByLabel(label, { exact }).evaluate((element, value) => {
    const area = element as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
}

async function gotoTool(page: Page, slug: string) {
  await page.goto(`/tools/${slug}`);
  await page.waitForLoadState("networkidle");
}

test("tools index lists both tools and links to them", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("private tools");
  await expect(page.getByRole("link", { name: /open the tool/i })).toHaveCount(2);
  await page.getByRole("link", { name: /open the tool/i }).first().click();
  await expect(page).toHaveURL(/\/tools\/laravel-scheduler-cron$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://thavarshan.com/tools/laravel-scheduler-cron");
});

test("site navigation and footer link to the tools section", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('footer a[href="/tools"]')).toBeVisible();
});

test.describe("Laravel scheduler cron helper", () => {
  test("explains an expression, suggests the exact helper and lists next runs", async ({ page }) => {
    await gotoTool(page, "laravel-scheduler-cron");
    const input = page.getByLabel("Cron expression");
    await input.fill("0 8 * * 1-5");
    await expect(page.getByTestId("cron-explanation")).toHaveText("At 08:00, on Monday through Friday");
    await expect(page.getByTestId("cron-match")).toContainText("built-in helper matches");
    await expect(page.getByTestId("cron-code")).toContainText("->weekdays()->at('08:00')");
    await expect(page.getByTestId("cron-code")).toContainText("Schedule::command('emails:send')");
    await expect(page.getByTestId("cron-runs").locator("tbody tr")).toHaveCount(8);
  });

  test("falls back to cron() honestly when no helper matches, and switches Laravel version", async ({ page }) => {
    await gotoTool(page, "laravel-scheduler-cron");
    await page.getByLabel("Cron expression").fill("*/7 * * * *");
    await expect(page.getByTestId("cron-match")).toContainText("No built-in helper matches");
    await expect(page.getByTestId("cron-code")).toContainText("->cron('*/7 * * * *')");
    await page.getByRole("button", { name: "Laravel 10 and earlier" }).click();
    await expect(page.getByTestId("cron-code")).toContainText("protected function schedule(Schedule $schedule)");
    await expect(page.getByRole("button", { name: "Laravel 10 and earlier" })).toHaveAttribute("aria-pressed", "true");
  });

  test("shows specific, announced errors for malformed input and recovers", async ({ page }) => {
    await gotoTool(page, "laravel-scheduler-cron");
    const input = page.getByLabel("Cron expression");
    await input.fill("60 * * * *");
    await expect(page.getByTestId("cron-results").getByRole("alert")).toContainText("Minute field \"60\": 60 is outside 0-59");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("cron-code")).toHaveCount(0);
    await input.fill("* * * * * *");
    await expect(page.getByTestId("cron-results").getByRole("alert")).toContainText("6-field");
    await input.fill("");
    await expect(page.getByTestId("cron-results").getByRole("alert")).toContainText("Enter a cron expression");
    await input.fill("@daily");
    await expect(page.getByTestId("cron-explanation")).toHaveText("At 00:00");
    await expect(page.getByTestId("cron-results").getByRole("alert")).toHaveCount(0);
  });

  test("warns when both day fields are set", async ({ page }) => {
    await gotoTool(page, "laravel-scheduler-cron");
    await page.getByLabel("Cron expression").fill("0 0 1,15 * 1");
    await expect(page.getByText(/Both day-of-month and day-of-week are set/)).toBeVisible();
  });

  test("presets, timezone and command inputs work by keyboard and mouse", async ({ page }) => {
    await gotoTool(page, "laravel-scheduler-cron");
    await page.getByRole("button", { name: "Every 15 minutes" }).click();
    await expect(page.getByLabel("Cron expression")).toHaveValue("*/15 * * * *");
    await page.getByLabel("Timezone").selectOption("Asia/Colombo");
    await expect(page.getByTestId("cron-code")).toContainText("->timezone('Asia/Colombo')");
    await page.getByLabel("Artisan command").fill("reports:generate");
    await expect(page.getByTestId("cron-code")).toContainText("reports:generate");
    await page.getByLabel("Artisan command").fill("bad'; DROP");
    await expect(page.getByTestId("cron-code")).toContainText("your:command");
    await expect(page.getByTestId("cron-code")).not.toContainText("DROP");
  });

  test("copies the generated code to the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoTool(page, "laravel-scheduler-cron");
    await page.getByLabel("Cron expression").fill("0 0 * * *");
    await page.getByRole("button", { name: "Copy code" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("->daily()");
  });
});

test.describe("Laravel .env checker", () => {
  test("finds the classic problems in the broken sample", async ({ page }) => {
    await gotoTool(page, "laravel-env-checker");
    await page.getByRole("button", { name: "Load a broken sample" }).click();
    const findings = page.getByTestId("env-findings");
    await expect(findings).toContainText("APP_NAME has spaces in an unquoted value");
    await expect(findings).toContainText("APP_DEBUG is on while APP_ENV is production");
    await expect(findings).toContainText("DB_HOST is defined 2 times");
    await expect(findings).toContainText("APP_KEY is empty");
    await expect(findings).toContainText("MAIL_FROM_NAME is never closed");
    await expect(page.getByTestId("env-summary")).toContainText("errors");
  });

  test("reports a clean bill of health and clears on demand", async ({ page }) => {
    await gotoTool(page, "laravel-env-checker");
    await page.getByRole("button", { name: "Load a healthy sample" }).click();
    await expect(page.getByTestId("env-summary")).toContainText("0 errors");
    await page.getByRole("button", { name: "Clear both" }).click();
    await expect(page.getByLabel(".env", { exact: true })).toHaveValue("");
    await expect(page.getByTestId("env-results")).toContainText("Results appear here");
  });

  test("compares two files and offers the missing keys", async ({ page }) => {
    await gotoTool(page, "laravel-env-checker");
    await page.getByLabel(".env", { exact: true }).fill("APP_ENV=local\nAPP_KEY=base64:" + "A".repeat(43) + "=\n");
    await page.getByLabel(".env.example").fill("APP_ENV=local\nREDIS_HOST=127.0.0.1\nAPP_KEY=\n");
    await expect(page.getByTestId("env-findings")).toContainText("REDIS_HOST is in .env.example but missing from .env");
    await expect(page.getByTestId("env-missing")).toHaveText("REDIS_HOST=127.0.0.1");
  });

  test("rejects oversized input clearly instead of freezing", async ({ page }) => {
    await gotoTool(page, "laravel-env-checker");
    await paste(page, ".env", "A=1\n".repeat(5200), true);
    await expect(page.getByTestId("env-results").getByRole("alert")).toContainText("too many lines");
    await paste(page, ".env", "x".repeat(300_000), true);
    await expect(page.getByTestId("env-results").getByRole("alert")).toContainText("too large");
    await paste(page, ".env", "A=1\n".repeat(4000), true);
    await expect(page.getByTestId("env-summary")).toBeVisible();
  });

  test("PRIVACY: pasted secrets never appear in results, are never sent over the network, and are never stored", async ({ page, context }) => {
    const seen: string[] = [];
    page.on("request", (request) => seen.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));

    await gotoTool(page, "laravel-env-checker");
    const before = seen.length;
    await paste(page, ".env", `APP_KEY=\nAPP_ENV=production\nAPP_DEBUG=true\nSTRIPE_SECRET=${SECRET}\nBROKEN=has spaces ${SECRET}\nDUP=1\nDUP=${SECRET}\n`, true);
    await paste(page, ".env.example", `STRIPE_SECRET=\nNEW_TOKEN=${SECRET}\n`);
    await expect(page.getByTestId("env-findings")).toContainText("BROKEN has spaces");
    await page.waitForTimeout(800);

    const results = await page.getByTestId("env-results").innerText();
    expect(results).not.toContain(SECRET);
    await page.getByRole("button", { name: "Copy full report" }).click().catch(() => undefined);

    // Nothing typed may leave the page (analytics/beacons included), whether in a URL or a body.
    expect(seen.slice(before).filter((entry) => entry.includes(SECRET))).toEqual([]);
    expect(seen.slice(before).filter((entry) => entry.includes(encodeURIComponent(SECRET)))).toEqual([]);

    // ...and nothing is persisted in the browser.
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie }));
    expect(storage).not.toContain(SECRET);
    expect(JSON.stringify(await context.cookies())).not.toContain(SECRET);
    expect(page.url()).not.toContain(SECRET);
  });
});

for (const slug of ["", "laravel-scheduler-cron", "laravel-env-checker"]) {
  test(`/tools${slug ? `/${slug}` : ""} has valid SEO metadata, structured data and no horizontal overflow at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/tools${slug ? `/${slug}` : ""}`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://thavarshan.com/tools${slug ? `/${slug}` : ""}`);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.length).toBeGreaterThan(0);
    for (const block of jsonLd) expect(() => JSON.parse(block)).not.toThrow();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
  });
}

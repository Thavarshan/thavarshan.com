import { expect, test, type Page } from "@playwright/test";

// Runs against the real Worker (`wrangler dev`, localhost auth bypass, fixture data, isolated local KV).
test.describe.configure({ mode: "serial" });

const titles = (page: Page) => page.locator("li.job h2");

async function reset(page: Page) {
  for (const id of ["00000000000000000001", "00000000000000000002", "00000000000000000004"]) {
    await page.request.post("/review", { form: { id, status: "new", note: "" }, headers: { Origin: "http://127.0.0.1:8799" }, maxRedirects: 0 });
  }
}

test.beforeEach(async ({ page }) => reset(page));

test("default view: eligible first, ineligible hidden, unknown fields marked, stale banner shown", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Job review" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("looks stale");
  // eligible first (by score), then unknown; ineligible hidden by default
  await expect(titles(page)).toHaveText(["Alpha Laravel Engineer", "Bravo Vue Engineer", "Delta Unknown Engineer"]);
  const delta = page.locator("li.job", { hasText: "Delta Unknown Engineer" });
  await expect(delta).toContainText("Confidence: not scored yet");
  await expect(delta).toContainText("Sponsorship: not mentioned");
  await expect(delta).toContainText("Salary: not listed");
  await expect(delta).toContainText("eligibility unclear");
  await expect(delta).toContainText("Concerns: Sri Lanka hiring eligibility is not explicit");
  // Missing data is described, never shown as a bare "unknown".
  await expect(page.locator("li.job .badge")).not.toContainText(["unknown"]);
});

test("shows every captured detail and the escaped posting text on demand", async ({ page }) => {
  await page.goto("/");
  const alpha = page.locator("li.job", { hasText: "Alpha Laravel Engineer" });
  await alpha.getByText("All details and posting text").click();
  await expect(alpha).toContainText("Employment type");
  await expect(alpha).toContainText("Full-Time");
  await expect(alpha).toContainText("Published");
  await expect(alpha).toContainText("2026-09-28");
  await expect(alpha).toContainText("per year");
  await expect(alpha).toContainText("Relocation");
  await expect(alpha).toContainText("offered");
  await expect(alpha).toContainText("Countries named");
  await expect(alpha).toContainText("DE");
  await expect(alpha).toContainText("CET");
  await expect(alpha).toContainText("larajobs #1");
  await expect(alpha.getByRole("link", { name: "careers.example.org" })).toHaveAttribute("href", "https://careers.example.org/apply/1");
  await expect(alpha).toContainText("We build Laravel products for schools.");
  // scraped text is untrusted: rendered as text, never as markup
  await expect(alpha.locator("pre.posting")).toContainText("<script>alert(1)</script>");
  expect(await alpha.locator("pre.posting script").count()).toBe(0);
  const delta = page.locator("li.job", { hasText: "Delta Unknown Engineer" });
  await delta.getByText("All details and posting text").click();
  await expect(delta).toContainText("No posting text was captured");
  await expect(delta).toContainText("Location");
  await expect(delta).toContainText("not listed");
  await expect(delta).toContainText("no constraint stated");
  await expect(delta).toContainText("none named");
});

test("filters narrow the list and are keyboard operable", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Technology").fill("vue");
  await page.getByLabel("Technology").press("Enter");
  await expect(titles(page)).toHaveText(["Bravo Vue Engineer"]);

  await page.goto("/");
  await page.getByLabel("Sponsorship").selectOption("confirmed");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(titles(page)).toHaveText(["Bravo Vue Engineer"]);

  await page.goto("/");
  await page.getByLabel("Min score").fill("85");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(titles(page)).toHaveText(["Alpha Laravel Engineer", "Delta Unknown Engineer"]);

  await page.getByRole("link", { name: "Reset" }).click();
  await expect(titles(page)).toHaveCount(3);

  await page.getByLabel("ineligible").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(titles(page)).toHaveCount(4);

  await page.goto("/?submitted=1&elig=eligible&min=100");
  await expect(page.getByText("No opportunities match these filters.")).toBeVisible();
});

test("explains the score and links to the canonical source safely", async ({ page }) => {
  await page.goto("/");
  const alpha = page.locator("li.job", { hasText: "Alpha Laravel Engineer" });
  await alpha.getByText("Why this score").click();
  await expect(alpha).toContainText("Laravel is explicitly required");
  await expect(alpha).toContainText("+30");
  await expect(alpha.getByRole("link", { name: "Alpha Laravel Engineer" })).toHaveAttribute("href", "https://example.com/jobs/1");
  await expect(alpha.getByRole("link", { name: "Alpha Laravel Engineer" })).toHaveAttribute("rel", /noopener noreferrer/);
});

test("shortlist, note and dismiss persist across reloads and drive the review filter", async ({ page }) => {
  await page.goto("/");
  const alpha = page.locator("li.job", { hasText: "Alpha Laravel Engineer" });
  await alpha.getByLabel("Status").selectOption("shortlisted");
  await alpha.getByLabel("Private note").fill("call on Monday");
  await alpha.getByRole("button", { name: "Save" }).click();

  await page.reload();
  await expect(page.locator("li.job", { hasText: "Alpha Laravel Engineer" }).getByLabel("Private note")).toHaveValue("call on Monday");

  await page.goto("/?review=shortlisted");
  await expect(titles(page)).toHaveText(["Alpha Laravel Engineer"]);

  const bravo = (await page.goto("/"), page.locator("li.job", { hasText: "Bravo Vue Engineer" }));
  await bravo.getByLabel("Status").selectOption("dismissed");
  await bravo.getByRole("button", { name: "Save" }).click();
  await expect(titles(page)).not.toContainText(["Bravo Vue Engineer"]);
  await page.goto("/?review=dismissed");
  await expect(titles(page)).toHaveText(["Bravo Vue Engineer"]);
});

test("responsive layout has no horizontal overflow on a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("responses are private and not indexable; unknown routes and cross-origin posts are refused", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("same-origin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect((await page.request.get("/nope")).status()).toBe(404);
  const forged = await page.request.post("/review", { form: { id: "00000000000000000001", status: "reviewed" }, headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
  expect(forged.status()).toBe(403);
});

test("platform: health endpoint, request ids and no CORS", async ({ page }) => {
  const health = await page.request.get("/healthz");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", version: "dev", environment: "production", kv: "ok" });
  expect(health.headers()["x-request-id"]).toBeTruthy();
  const preflight = await page.request.fetch("/review", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
  expect(preflight.status()).toBe(405);
  expect(Object.keys(preflight.headers()).filter((name) => name.startsWith("access-control-"))).toEqual([]);
});

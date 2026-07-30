import { expect, test } from "@playwright/test";

test("homepage renders the professional narrative", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Jerome Thayananthajothy" })).toBeVisible();
  await expect(page.getByRole("link", { name: /resume/i }).first()).toHaveAttribute("href", "/docs/Jerome-Resume.pdf");
  await expect(page.getByRole("heading", { name: "Fetch PHP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sino Lanka Group" })).toBeVisible();
});

test("indexable CV and projects pages expose canonical metadata", async ({ page }) => {
  await page.goto("/cv");
  await expect(page.getByRole("heading", { name: "Jerome Thayananthajothy" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://thavarshan.com/cv");

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: /developer tools with measurable adoption/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /project details/i }).first()).toHaveAttribute("href", /\/projects\//);
});

test("project details render source-driven metadata and structured data", async ({ page }) => {
  await page.goto("/projects/fetch-php");

  await expect(page.getByRole("heading", { name: "Fetch PHP" })).toBeVisible();
  await expect(page.getByText(/450 stars/i)).toBeVisible();
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain("SoftwareSourceCode");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://thavarshan.com/projects/fetch-php"
  );
});

test("SEO discovery endpoints list public profile routes", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  const robots = await request.get("/robots.txt");

  expect(await sitemap.text()).toContain("https://thavarshan.com/projects/fetch-php");
  expect(await sitemap.text()).toContain("https://thavarshan.com/cv");
  expect(await robots.text()).toContain("https://thavarshan.com/sitemap.xml");
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  expect(overflow).toBe(false);
});

test("contact primary link remains readable while active", async ({ page }) => {
  await page.goto("/#contact");

  const emailLink = page.getByRole("link", { name: /email/i }).last();
  await expect(emailLink).toBeVisible();

  const normalColors = await emailLink.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return { color: styles.color, background: styles.backgroundColor };
  });
  expect(normalColors.color).not.toBe(normalColors.background);

  const box = await emailLink.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const activeColors = await emailLink.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return { color: styles.color, background: styles.backgroundColor };
  });
  await page.mouse.up();

  expect(activeColors.color).not.toBe(activeColors.background);
});

test("old blog routes redirect to relevant destinations", async ({ page }) => {
  const response = await page.goto("/blog/fetch-php");

  expect(response?.url()).toContain("github.com/Thavarshan/fetch-php");
});

test("resume is served from public docs", async ({ request }) => {
  const response = await request.get("/docs/Jerome-Resume.pdf");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.url()).toContain("Jerome-Resume");
});

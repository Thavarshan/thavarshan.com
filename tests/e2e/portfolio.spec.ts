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
  expect(await sitemap.text()).toContain("https://thavarshan.com/insights/observable-reliable-production-ai-workflows");
  expect(await robots.text()).toContain("https://thavarshan.com/sitemap.xml");
});

test("insights routes, RSS, and article structured data are crawlable", async ({ page, request }) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: /practical notes from building ai systems/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /building observable and reliable production ai workflows/i })).toHaveAttribute(
    "href",
    "/insights/observable-reliable-production-ai-workflows"
  );

  await page.goto("/insights/observable-reliable-production-ai-workflows");
  await expect(page.getByRole("heading", { name: "Building observable and reliable production AI workflows" })).toBeVisible();
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain("Article");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://thavarshan.com/insights/observable-reliable-production-ai-workflows"
  );

  const feed = await request.get("/feed.xml");
  expect(await feed.text()).toContain("Building observable and reliable production AI workflows");
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  expect(overflow).toBe(false);
});

test("contact primary link remains readable while active", async ({ page }) => {
  await page.goto("/#contact");

  const emailLink = page.getByRole("link", { name: /start a conversation/i }).last();
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

test("old blog routes are preserved in the Netlify redirect manifest", async ({ request }) => {
  const response = await request.get("/_redirects");
  const redirects = await response.text();

  expect(redirects).toContain("/blog/fetch-php https://github.com/Thavarshan/fetch-php 301!");
  expect(redirects).toContain("/blog /projects 301!");
});

test("resume is served from public docs", async ({ request }) => {
  const response = await request.get("/docs/Jerome-Resume.pdf");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.url()).toContain("Jerome-Resume");
});

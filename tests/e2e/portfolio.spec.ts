import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const githubData = JSON.parse(readFileSync(new URL("../../data/github.generated.json", import.meta.url), "utf8")) as {
  projects: Array<{ repository: string; stars: number }>;
};

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
  const fetchPhp = githubData.projects.find((project) => project.repository === "fetch-php");
  expect(fetchPhp).toBeDefined();
  await expect(page.getByText(new RegExp(`${fetchPhp!.stars.toLocaleString()} stars`, "i"))).toBeVisible();
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain("SoftwareSourceCode");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://thavarshan.com/projects/fetch-php"
  );
});

test("exported project links resolve and are discoverable", async ({ page, request }) => {
  await page.goto("/projects");

  const projectLinks = await page
    .getByRole("link", { name: /project details/i })
    .evaluateAll((links) =>
      Array.from(new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href))))
    );
  expect(projectLinks.length).toBeGreaterThan(0);

  const sitemap = await request.get("/sitemap.xml");
  const sitemapText = await sitemap.text();

  for (const href of projectLinks) {
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect(sitemapText).toContain(`https://thavarshan.com${href}`);
  }
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

test("narrow mobile layout stays readable and overflow-free", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  for (const route of ["/", "/projects", "/cv", "/insights", "/privacy"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      width: document.documentElement.clientWidth
    }));

    expect(dimensions.overflow, `${route} overflows at 320px`).toBe(false);
    expect(dimensions.width).toBe(320);
  }
});

test("mobile navigation is accessible and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.focus();
  await menuButton.press("Enter");

  await expect(page.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-navigation")).toBeVisible();
  await expect(page.locator("#mobile-navigation")).toContainText("Insights");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-navigation")).toBeHidden();
});

test("the menu toggle stays inside the viewport on narrow screens", async ({ page }) => {
  for (const width of [320, 375, 430, 768, 900]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Open navigation menu" });
    await expect(menuButton, `menu toggle hidden at ${width}px`).toBeVisible();

    const box = await menuButton.boundingBox();
    expect(box, `menu toggle has no box at ${width}px`).not.toBeNull();
    expect(box!.x, `menu toggle starts offscreen at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `menu toggle overflows at ${width}px`).toBeLessThanOrEqual(width);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // The header keeps only the essentials until there is room for the full bar.
    const headerLinks = page.locator("header a", { hasText: "GitHub" });
    await expect(headerLinks.locator("visible=true")).toHaveCount(0);
  }
});

test("mobile navigation closes when the backdrop is tapped", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.locator("#mobile-navigation")).toBeVisible();

  await page.mouse.click(188, 780);

  await expect(page.locator("#mobile-navigation")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
});

test("the desktop bar exposes navigation without a menu toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: /navigation menu/i })).toBeHidden();
  await expect(page.locator("header a", { hasText: "Insights" }).first()).toBeVisible();
  await expect(page.locator("header a", { hasText: "GitHub" }).locator("visible=true")).toHaveCount(1);
});

test("mobile CTA links preserve touch-friendly target sizes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const heights = await page.locator(".mobile-stack-actions a").evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().height))
  );

  expect(heights.length).toBeGreaterThan(0);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
});

test("anchor navigation accounts for the fixed header", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#projects");

  const top = await page.locator("#projects").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(top).toBeGreaterThanOrEqual(65);
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
  const body = await response.body();

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.url()).toBe("http://127.0.0.1:4173/docs/Jerome-Resume.pdf");
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
});

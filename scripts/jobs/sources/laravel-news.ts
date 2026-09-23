import type { Page } from "@playwright/test";

export const laravelNewsUrl = "https://laravel-news.com/";

export async function collectLaravelNewsLinks(page: Page): Promise<string[]> {
  await page.goto(laravelNewsUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  return page.locator('a[href*="larajobs.com/job/"]').evaluateAll((anchors) =>
    [...new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean))]
  );
}

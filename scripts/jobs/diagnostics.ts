import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

const diagnosticsDir = resolve(".jobs-diagnostics");

export async function recordSourceFailure(source: string, error: unknown, page?: Page): Promise<void> {
  try {
    await mkdir(diagnosticsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `${source}-${stamp}`;

    const detail = {
      source,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    await writeFile(resolve(diagnosticsDir, `${base}.json`), JSON.stringify(detail, null, 2), "utf8");

    if (page && !page.isClosed()) {
      await page.screenshot({ path: resolve(diagnosticsDir, `${base}.png`) }).catch(() => undefined);
    }
  } catch (diagnosticError) {
    console.warn(`Failed to record diagnostics for ${source}: ${diagnosticError instanceof Error ? diagnosticError.message : diagnosticError}`);
  }
}

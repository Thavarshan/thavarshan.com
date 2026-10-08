import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/seo",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  outputDir: "test-results/seo",
  use: {
    baseURL: "http://127.0.0.1:4176",
    javaScriptEnabled: false
  },
  webServer: {
    command: `${process.env.CI_PREBUILT === "1" ? "" : "npm run build && "}node --import tsx automation/static-server.ts out --hostname 127.0.0.1 --port 4176`,
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
    timeout: 120_000
  }
});

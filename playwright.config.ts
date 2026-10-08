import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npm run build && npm start -- --hostname 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120_000,
      // Telemetry is inert off the production host unless enabled; e2e points it at a URL the tests intercept.
      env: { NEXT_PUBLIC_METRICS_LOCAL: "1", NEXT_PUBLIC_METRICS_URL: "http://127.0.0.1:4175/collect" }
    },
    {
      // Serves the fixture snapshot that the job-review Worker fetches instead of the live GitHub copy.
      command: "npx tsx automation/static-server.ts tests/e2e/fixtures --hostname 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/jobs.json",
      reuseExistingServer: false
    },
    {
      // The real Worker with the localhost-only auth bypass and an isolated, disposable local KV.
      command:
        "npx wrangler dev --config workers/job-review/wrangler.toml --ip 127.0.0.1 --port 8799 --persist-to .wrangler-e2e " +
        "--var JOBS_DATA_URL:http://127.0.0.1:4174/jobs.json --var DEV_AUTH_BYPASS:1",
      url: "http://127.0.0.1:8799/",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { WRANGLER_SEND_METRICS: "false", CI: "1" }
    }
  ],
  projects: [
    {
      name: "desktop",
      testIgnore: /job-review\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      testIgnore: /job-review\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    },
    {
      // Serial and single-project: the Worker's KV state is shared across tests.
      name: "job-review",
      testMatch: /job-review\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:8799" }
    }
  ]
});

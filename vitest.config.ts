import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.ts", "tests/components/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"]
  },
  resolve: {
    // Mirrors tsconfig "paths". "@/" is application source (src/); the others are trees that live outside it.
    alias: [
      { find: /^@generated\//, replacement: new URL("./data/", import.meta.url).pathname },
      { find: /^@scripts\//, replacement: new URL("./scripts/", import.meta.url).pathname },
      { find: /^@workers\//, replacement: new URL("./workers/", import.meta.url).pathname },
      { find: /^@\//, replacement: new URL("./src/", import.meta.url).pathname }
    ]
  }
});

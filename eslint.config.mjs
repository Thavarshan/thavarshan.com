import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Import-boundary rules (see docs/architecture.md). They encode the dependency directions the
 * repository relies on, so a wrong-way import fails lint instead of surviving review:
 *
 *   routes (src/app) -> components -> domain (src/lib)    never the reverse
 *   automation (scripts/) and Workers (workers/) are runtime adapters: they use src/lib, never src/app or each other
 *   runtime-neutral code (edge utilities, event contracts, tools) must not touch Node, React or Next
 */
const pattern = (group, message) => ({ group, message });

const fromUi = pattern(["@/app/*", "@/app/**", "@/components/*", "@/components/**", "**/app/**", "**/components/**"], "Domain, automation and Worker code must not import routes or UI components.");
const fromAutomation = pattern(["@scripts/*", "@scripts/**", "**/scripts/**"], "Only automation may import automation; move shared code to lib/.");
const fromWorkers = pattern(["@workers/*", "@workers/**", "**/workers/**"], "Workers are deployable entrypoints; share code through lib/, not across Workers.");
const reactAndNext = pattern(["react", "react-dom", "react/*", "next", "next/*"], "This code must stay runtime-neutral (no React or Next.js).");
const nodeBuiltins = pattern(["node:*"], "This code must stay runtime-neutral (no Node built-ins); put Node code in lib/node or automation.");

const boundaryRules = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "node_modules/**", "playwright-report/**", "test-results/**", "**/.wrangler/**", ".wrangler-e2e/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  },

  // Domain code never depends on routes, UI, pipelines or Workers.
  { files: ["src/lib/**/*.{ts,tsx}"], rules: boundaryRules(fromUi, fromAutomation, fromWorkers) },
  // UI never depends on pipelines or Workers.
  { files: ["src/components/**/*.{ts,tsx}"], rules: boundaryRules(fromAutomation, fromWorkers) },
  // Routes compose domain code and UI; they do not reach into pipelines or Workers.
  { files: ["src/app/**/*.{ts,tsx}"], rules: boundaryRules(fromAutomation, fromWorkers) },
  // Pipelines are independent of the UI and of Workers.
  { files: ["scripts/**/*.ts"], rules: boundaryRules(fromUi, fromWorkers) },
  // Workers are edge adapters: no UI, no Node pipelines, no other Worker, no React/Next. Each Worker also
  // names its siblings explicitly, because a relative import like "../job-review/x" carries no "workers/".
  ...["job-review", "site-metrics"].map((name) => ({
    files: [`workers/${name}/**/*.ts`],
    rules: boundaryRules(
      fromUi,
      fromAutomation,
      fromWorkers,
      reactAndNext,
      ...["job-review", "site-metrics"]
        .filter((other) => other !== name)
        .map((other) => pattern([`../${other}`, `../${other}/**`, `../../${other}`, `../../workers/${other}/**`, `@workers/${other}/**`], `The ${name} Worker must not import the ${other} Worker; share code through lib/.`))
    )
  })),
  // Runtime-neutral code: usable in the browser, in Node and on the edge.
  {
    files: ["src/lib/edge/**/*.ts", "src/lib/telemetry/events.ts", "src/lib/telemetry/snapshot.ts", "src/lib/telemetry/goals.ts", "src/lib/tools/**/*.ts"],
    rules: boundaryRules(fromUi, fromAutomation, fromWorkers, reactAndNext, nodeBuiltins)
  },
  // Browser-side telemetry must not pull in Node.
  { files: ["src/lib/telemetry/client.ts", "src/components/**/*.tsx"], rules: boundaryRules(fromAutomation, fromWorkers, nodeBuiltins) }
];

export default eslintConfig;

import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Import-boundary rules (see docs/architecture.md). They encode the dependency directions the
 * repository relies on, so a wrong-way import fails lint instead of surviving review:
 *
 *   src/app (routes) -> src/components, src/features -> src/shared        never the reverse
 *   automation/ (automation) and workers/ (edge) are runtime adapters: they use src/features and src/shared,
 *   never src/app or src/components, never each other
 *   runtime-neutral code (edge utilities, event contracts, tools) must not touch Node, React or Next
 */
const pattern = (group, message) => ({ group, message });

const fromApp = pattern(["@/app", "@/app/*", "@/app/**", "**/app/**"], "Nothing imports routes; routes import features and components.");
const fromUi = pattern(["@/app", "@/app/**", "@/components", "@/components/**", "**/app/**", "**/components/**"], "Domain, automation and Worker code must not import routes or UI components.");
const fromAutomation = pattern(["@automation/*", "@automation/**", "**/automation/**"], "Only automation may import automation; move shared code to src/shared or a feature.");
const fromWorkers = pattern(["@workers/*", "@workers/**", "**/workers/**"], "Workers are deployable entrypoints; share code through src/shared, not across Workers.");
const fromFeatures = pattern(["@/features", "@/features/*", "@/features/**", "**/features/**"], "Shared modules are below features in the dependency order; they must not import a feature.");
const reactAndNext = pattern(["react", "react-dom", "react/*", "next", "next/*"], "This code must stay runtime-neutral (no React or Next.js).");
const nodeBuiltins = pattern(["node:*"], "This code must stay runtime-neutral (no Node built-ins); put Node code in src/shared/node or automation.");

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

  // Feature domain code (.ts) never depends on routes, UI, pipelines or Workers, and stays free of Node
  // built-ins. Code that genuinely needs Node (filesystem, processes) must say so in its name: *.node.ts.
  { files: ["src/features/**/*.ts"], ignores: ["src/features/**/*.node.ts"], rules: boundaryRules(fromUi, fromAutomation, fromWorkers, nodeBuiltins) },
  { files: ["src/features/**/*.node.ts"], rules: boundaryRules(fromUi, fromAutomation, fromWorkers) },
  // Feature components and shared UI render in the browser: no routes, pipelines, Workers or Node built-ins.
  { files: ["src/features/**/*.tsx", "src/components/**/*.{ts,tsx}"], rules: boundaryRules(fromApp, fromAutomation, fromWorkers, nodeBuiltins) },
  // Routes compose features and components; they do not reach into pipelines or Workers.
  { files: ["src/app/**/*.{ts,tsx}"], rules: boundaryRules(fromAutomation, fromWorkers) },
  // Shared building blocks sit below features, routes and UI.
  { files: ["src/shared/node/**/*.ts"], rules: boundaryRules(fromUi, fromFeatures, fromAutomation, fromWorkers) },
  // Foundational configuration: depends on nothing above it.
  { files: ["src/shared/config/**/*.ts"], rules: boundaryRules(fromUi, fromFeatures, fromAutomation, fromWorkers) },
  // Pipelines are independent of the UI and of Workers.
  { files: ["automation/**/*.ts"], rules: boundaryRules(fromUi, fromWorkers) },
  // Workers are edge adapters: no UI, no Node pipelines, no other Worker, no React/Next. Each Worker also
  // names its siblings explicitly, because a relative import like "../job-review/x" carries no "workers/".
  ...["job-review", "site-metrics"].map((name) => ({
    files: [`workers/${name}/**/*.ts`],
    rules: boundaryRules(
      fromUi,
      fromAutomation,
      fromWorkers,
      reactAndNext,
      nodeBuiltins,
      ...["job-review", "site-metrics"]
        .filter((other) => other !== name)
        .map((other) => pattern([`../${other}`, `../${other}/**`, `../../${other}`, `../../workers/${other}/**`, `@workers/${other}/**`], `The ${name} Worker must not import the ${other} Worker; share code through src/shared.`))
    )
  })),
  // Runtime-neutral code: usable in the browser, in Node and on the edge (the jobs feature runs inside a Worker).
  {
    files: ["src/features/telemetry/events.ts", "src/features/telemetry/snapshot.ts", "src/features/telemetry/goals.ts", "src/features/tools/*.ts", "src/features/jobs/**/*.ts", "src/features/github/**/*.ts", "src/features/profile/**/*.ts"],
    rules: boundaryRules(fromUi, fromAutomation, fromWorkers, reactAndNext, nodeBuiltins)
  },
  // Shared edge utilities are runtime-neutral AND sit below features.
  { files: ["src/shared/edge/**/*.ts"], rules: boundaryRules(fromUi, fromFeatures, fromAutomation, fromWorkers, reactAndNext, nodeBuiltins) },
  // Browser-side telemetry must not pull in Node.
  { files: ["src/features/telemetry/client.ts"], rules: boundaryRules(fromAutomation, fromWorkers, nodeBuiltins) }
];

export default eslintConfig;

# Repository architecture

One repository, one npm package, clear internal boundaries. The codebase is large enough to benefit from feature ownership, but not large enough to justify a monorepo's build and deployment overhead (see `docs/adr/0002-single-package-structure.md`).

This document is the source of truth for **where code lives and what may import what**. The restructuring is delivered as a sequence of small pull requests that move code without changing behaviour; the status table at the bottom records progress.

## What lives where

| Path | Owns | Runs in |
| --- | --- | --- |
| `src/app/` | Next.js routes, metadata, route-level composition | build (static export) + browser |
| `src/components/ui/`, `src/components/layout/` | Small reusable presentation components; navigation, footer and site shell | browser |
| `src/features/profile/` | Profile schema, conflicts, LinkedIn import; authored profile data; `site.ts` (site identity derived from the profile) | build + Node |
| `src/features/github/` | GitHub snapshot contract and reader (a low-level data contract used by several features) | build + Node |
| `src/features/home/` | Home-page sections (hero, timeline) composed from profile data | build |
| `src/features/projects/` | Package-registry model, featured projects, case studies, project card | build |
| `src/features/insights/` | Insight model, content loader, article components | build |
| `src/features/cv/` | LaTeX rendering and CV tailoring-plan validation | build + Node |
| `src/features/jobs/` | Snapshot contract and migration, scoring, eligibility, review rules | any (pure) |
| `src/features/applications/` | Deterministic application preparation, cover-letter rendering, hallucination check, free Groq AI configuration | Node |
| `src/features/marketing/` | OSS distribution bundle rules | Node |
| `src/features/tools/` | Cron and `.env` tools, registry; `components/` holds the client UI | browser (pure logic) |
| `src/features/telemetry/` | Event contract, browser client, snapshot builder, UTM helper, provider | browser + edge + Node |
| `src/shared/edge/` | Utilities shared by Cloudflare Workers | edge |
| `src/shared/node/` | Atomic file writes, retry/concurrency, other shared CLI code | Node |
| `src/shared/config/` | Foundational authored configuration (`profile-policy.ts`): depends on nothing | build |
| `data/*.generated.json`, `data/growth/` | **Generated snapshots (interfaces, see below)** | committed by workflows |
| `automation/` | Automation entrypoints and pipeline integrations (profile, jobs, applications, cv, marketing, growth, structure) | Node / GitHub Actions |
| `workers/job-review/`, `workers/site-metrics/` | Deployable Cloudflare Workers (entrypoint, auth/rendering, Wrangler config) | edge |
| `content/insights/` | Authored articles | build |
| `cv/` | LaTeX sources and generated TeX | Docker / CI |
| `marketing/` | Generated promotion drafts and the OSS ledger | committed by workflows |
| `public/` | Files served at stable URLs | static |
| `tests/unit/<feature>/` | Pure logic, one folder per feature | Vitest |
| `tests/integration/{workers,automation,structure}/` | Worker handlers, pipeline boundaries, repository-structure guards | Vitest |
| `tests/components/`, `tests/e2e/`, `tests/fixtures/`, `tests/helpers/` | Component tests, browser journeys, fixtures, shared test builders | Vitest / Playwright |
| `docs/`, `docs/adr/` | Documentation and decision records | - |

Still to come: pipeline entrypoints move from `automation/` to `automation/`, and unit tests are reorganised to mirror features. `data/` (generated JSON only), `public/`, `content/` and build/Wrangler configuration stay where their tools require them.

**Import aliases** (`tsconfig.json`, mirrored in `vitest.config.ts`): `@/*` is application source (`src/*`); `@generated/*` is the committed generated JSON in `data/`; `@automation/*` and `@workers/*` reach those trees from tests. Automation and Workers use relative imports.

## Dependency rules

Enforced by lint (`no-restricted-imports` in `eslint.config.mjs`) where a path pattern can express them:

1. **Routes compose features.** `src/app/` may import `src/components/` and `src/lib/`; nothing imports `src/app/` (except the framework).
2. **Domain code is independent.** `src/lib/` never imports `src/app/`, `src/components/`, `automation/` or `workers/`.
3. **Automation and Workers are runtime adapters.** `automation/` does not import UI or Workers; `workers/` does not import UI, `automation/`, React or Next.js, and **one Worker never imports another**. Anything two of them need goes in `src/lib/`.
4. **Runtime-neutral code stays neutral.** `src/shared/edge/`, the telemetry event contract, snapshot builder and goal mapping, and `src/features/tools/` must not import Node built-ins, React or Next.js. Browser-side telemetry and UI components must not import Node built-ins.
5. **Side effects live at the edge.** Browser telemetry, GitHub fetching, KV access, scraping, PDF compilation and filesystem writes stay in the adapter for their runtime.

**Node-only code is named as such.** A module that genuinely needs Node (filesystem, processes) ends in `.node.ts` (for example `src/features/insights/insights.node.ts`, the content loader); `node:*` imports are rejected by lint everywhere in `src` except `*.node.ts` and `src/shared/node/`, and never allowed in Workers. Everything else in `src/features` is runtime-neutral, including the jobs, GitHub and profile features: hashing uses the pure `src/shared/edge/sha256.ts` (byte-for-byte identical to Node's `createHash("sha256")`, checked against every stored job id and fingerprint), so the job-review Worker needs no Node compatibility flag and the cost guard now forbids compatibility flags entirely.

## Generated files are interfaces

Workflows commit these, scripts write them, the site builds from them, and one Worker fetches `data/jobs.generated.json` by its exact raw GitHub URL. **Moving one is a coordinated migration, never a side effect of reorganising code.** `tests/integration/structure/structure-generated-interfaces.test.ts` records each path and the files that must keep referring to it.

| Path | Consumers |
| --- | --- |
| `data/jobs.generated.json` | jobs workflow, `automation/jobs`, `automation/applications`, the job-review Worker (raw URL) |
| `data/profile.generated.json`, `data/github.generated.json`, `data/package-registry.generated.json` | content workflow, site, CV, marketing |
| `data/growth/` | growth-metrics workflow and script |
| `marketing/oss-ledger.json`, `marketing/oss/`, `marketing/generated/` | marketing workflows and scripts |
| `public/docs/Jerome-Resume.pdf` (and `-fallback.pdf`) | the stable public CV URL; CV publishing |
| `cv/generated/` | CV render/build/publish |

## Dependency layering (guarded, and acyclic)

```text
shared/config ─▶ features/github ─▶ features/profile ─┬▶ features/cv ─▶ features/applications
                                                       ├▶ features/projects ─▶ features/marketing
                                                       ├▶ features/telemetry ─▶ components/ui ─▶ components/layout, features/home
                                                       └▶ features/tools, features/insights ─────────▶ src/app (routes)
shared/edge, shared/node  (independent)        features/jobs  (independent; used by the job-review Worker and automation)
```

`features/applications` also consumes the `features/jobs` and `features/github` data types for deterministic preparation; those dependencies remain acyclic. `tests/integration/structure/import-graph.test.ts` enforces this. Lint blocks forbidden *directions*; this test guards the *allowed graph*: it fails on any dependency between units that is not declared in the test (so a new dependency is a visible, reviewed change), on any cycle, on unowned directories, and on a Worker pulling anything beyond its allowance into its deployed bundle. Restructuring found and removed the real cycles (profile↔projects, applications↔cv, config↔profile, and a chain through the UI) by moving `github-model`/`github` into their own feature, `profile-policy` into `shared/config`, CV `tailoring` into `cv`, `hero`/`timeline` into `home`, and `site.ts` into `profile`, the feature it is derived from.

## Formatting

All TypeScript in `src`, `automation`, `workers`, `tests` and the root config files is formatted with Prettier (`npm run format` to fix, `npm run format:check` in CI). Settings live in `.prettierrc.json` and mirror `.editorconfig` (160 columns, 2 spaces). Generated and non-code content (`data`, `marketing`, `cv`, `public`, `docs`, `content`, fixtures, lockfile) is ignored via `.prettierignore`.

Three JSX spots are marked `{/* prettier-ignore */}` because their whitespace is significant: reflowing them makes React emit different text-node markers and so changes the served HTML. Keep the marker if you edit them. The initial reformat was verified as whitespace-only by compiling every file before and after with esbuild (minified) and requiring identical output for all 187 files, plus an identical rendered site.

## Public URLs do not change

`npm run structure:routes` (run after `npm run build`, and in CI) compares the static export against `tests/fixtures/structure/routes.json`: page patterns, generated files (sitemap, feed, robots, social images) and static assets. Content growth (another Insight or project) does not trip it; a removed, renamed or added route kind does. If a change is intentional: `npm run structure:routes -- --write` and review the diff.

## Decisions recorded here

- **Duplicate PDF removed.** `assets/docs/Jerome-Resume.pdf` was byte-identical to `public/docs/Jerome-Resume-fallback.pdf` and referenced by nothing. The `public/` copy is kept because it is served at a public URL that external links may use.
- **Cross-pipeline helpers extracted first**, since they were real coupling: Worker platform utilities (`src/shared/edge/platform.ts`), atomic file writes (`src/shared/node/fs.ts`) and retry/concurrency (`src/shared/node/async.ts`).

## Guards that keep the structure honest

| Guard | Protects |
| --- | --- |
| `tests/integration/structure/import-graph.test.ts` | module graph stays acyclic; new dependencies are declared on purpose; each Worker's bundle stays within its allowance |
| `tests/integration/structure/workflow-paths.test.ts` | workflow trigger filters and `vitest run` paths still point at real files (a stale one silently stops a deploy or fails a job later) |
| `tests/integration/structure/structure-generated-interfaces.test.ts` | generated files and the consumers that depend on them |
| `npm run structure:routes` (CI) | public URLs, feeds, sitemap, social images and assets |
| `eslint.config.mjs` | forbidden import directions and runtime-neutrality |
| `npm run format:check` (CI) | consistent formatting of all TypeScript (Prettier, 160 columns to match `.editorconfig`, no trailing commas) |
| `tests/integration/workers/worker-cost-guard.test.ts` | Worker configuration can only use free-plan features |

## Migration status

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Baseline and guardrails: route inventory, generated-interface test, import-boundary lint, Next.js lint rules, shared helpers extracted, duplicate PDF removed, this document | done (#87) |
| 2 | Relocate `app/`, `components/`, `lib/`, authored `data/*.ts` under `src/` (alias change), generated JSON stays | done (#88) |
| 3 | Group code by feature under `src/features/*` and `src/shared/*`; split `components/` into `ui`/`layout` | done (#89) |
| 4 | `automation/` to `automation/`, shared Node/edge modules under `src/shared` | planned |
| 5 | Break the dependency cycles the new layout exposed; guard the module graph and workflow path references | done (#91, #92) |

**Result:** completed in six pull requests (#87 to #92), each verified by rebuilding and comparing the rendered site against the pre-change build (69 files identical), the URL inventory, a byte-identical CV re-render, Worker bundle sizes, and the full unit and browser suites. Verifying the workflows on GitHub's runners after the moves found one class of bug the local checks could not (stale test-path filters in four workflows), which is why the workflow-path guard exists.

**Acceptance for every step:** public URLs and generated-data contracts unchanged; static export and both Workers deploy; CV generation reproducible; lint, typecheck, unit, browser and relevant Worker tests pass.

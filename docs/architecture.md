# Repository architecture

One repository, one npm package, clear internal boundaries. The codebase is large enough to benefit from feature ownership, but not large enough to justify a monorepo's build and deployment overhead (see `docs/adr/0002-single-package-structure.md`).

This document is the source of truth for **where code lives and what may import what**. The restructuring is delivered as a sequence of small pull requests that move code without changing behaviour; the status table at the bottom records progress.

## What lives where (today)

| Path | Owns | Runs in |
| --- | --- | --- |
| `app/` | Next.js routes, metadata, route-level composition | build (static export) + browser |
| `components/` | Reusable UI, including client components | browser |
| `lib/` | Domain code: schemas, scoring, contracts, pure transformations | any (see runtime rules) |
| `lib/edge/` | Utilities shared by Cloudflare Workers | edge |
| `lib/node/` | Atomic file writes, retry/concurrency, other shared CLI code | Node |
| `data/*.ts` | Authored site data | build |
| `data/*.generated.json`, `data/growth/` | **Generated snapshots (interfaces, see below)** | committed by workflows |
| `scripts/` | Automation entrypoints and pipeline integrations (profile, jobs, applications, cv, marketing, growth, structure) | Node / GitHub Actions |
| `workers/job-review/`, `workers/site-metrics/` | Deployable Cloudflare Workers (entrypoint, auth/rendering, Wrangler config) | edge |
| `content/insights/` | Authored articles | build |
| `cv/` | LaTeX sources and generated TeX | Docker / CI |
| `marketing/` | Generated promotion drafts and the OSS ledger | committed by workflows |
| `public/` | Files served at stable URLs | static |
| `tests/` | `unit/`, `components/`, `e2e/`, `fixtures/` | Vitest / Playwright |
| `docs/`, `docs/adr/` | Documentation and decision records | - |

Target layout (the migration's destination): application source under `src/` (`app`, `components/{layout,ui}`, `features/*`, `shared/{edge,node,config}`), pipeline entrypoints under `automation/`, Workers staying under `workers/`, tests mirroring features. `data/`, `public/`, `content/` and build/Wrangler configuration stay where their tools require them.

## Dependency rules

Enforced by lint (`no-restricted-imports` in `eslint.config.mjs`) where a path pattern can express them:

1. **Routes compose features.** `app/` may import `components/` and `lib/`; nothing imports `app/` (except the framework).
2. **Domain code is independent.** `lib/` never imports `app/`, `components/`, `scripts/` or `workers/`.
3. **Automation and Workers are runtime adapters.** `scripts/` does not import UI or Workers; `workers/` does not import UI, `scripts/`, React or Next.js, and **one Worker never imports another**. Anything two of them need goes in `lib/`.
4. **Runtime-neutral code stays neutral.** `lib/edge/`, the telemetry event contract, snapshot builder and goal mapping, and `lib/tools/` must not import Node built-ins, React or Next.js. Browser-side telemetry and UI components must not import Node built-ins.
5. **Side effects live at the edge.** Browser telemetry, GitHub fetching, KV access, scraping, PDF compilation and filesystem writes stay in the adapter for their runtime.

Convention (not yet mechanically enforceable): modules that use Node APIs are server-only; `lib/insights.ts`, `lib/linkedin-archive.ts` and `lib/job-opportunities.ts` still import `node:*` and are the known exceptions to rule 4's spirit (the last one is used by the job-review Worker under `nodejs_compat`). Splitting them is part of the feature-grouping step.

## Generated files are interfaces

Workflows commit these, scripts write them, the site builds from them, and one Worker fetches `data/jobs.generated.json` by its exact raw GitHub URL. **Moving one is a coordinated migration, never a side effect of reorganising code.** `tests/unit/structure-generated-interfaces.test.ts` records each path and the files that must keep referring to it.

| Path | Consumers |
| --- | --- |
| `data/jobs.generated.json` | jobs workflow, `scripts/jobs`, `scripts/applications`, the job-review Worker (raw URL) |
| `data/profile.generated.json`, `data/github.generated.json`, `data/package-registry.generated.json` | content workflow, site, CV, marketing |
| `data/growth/` | growth-metrics workflow and script |
| `marketing/oss-ledger.json`, `marketing/oss/`, `marketing/generated/` | marketing workflows and scripts |
| `public/docs/Jerome-Resume.pdf` (and `-fallback.pdf`) | the stable public CV URL; CV publishing |
| `cv/generated/` | CV render/build/publish |

## Public URLs do not change

`npm run structure:routes` (run after `npm run build`, and in CI) compares the static export against `tests/fixtures/structure/routes.json`: page patterns, generated files (sitemap, feed, robots, social images) and static assets. Content growth (another Insight or project) does not trip it; a removed, renamed or added route kind does. If a change is intentional: `npm run structure:routes -- --write` and review the diff.

## Decisions recorded here

- **Duplicate PDF removed.** `assets/docs/Jerome-Resume.pdf` was byte-identical to `public/docs/Jerome-Resume-fallback.pdf` and referenced by nothing. The `public/` copy is kept because it is served at a public URL that external links may use.
- **Formatting check deferred.** A formatter needs a one-time reformat of the whole repository; that would bury the structural diffs, so it gets its own PR after the moves.
- **Cross-pipeline helpers extracted first**, since they were real coupling: Worker platform utilities (`lib/edge/platform.ts`), atomic file writes (`lib/node/fs.ts`) and retry/concurrency (`lib/node/async.ts`).

## Migration status

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Baseline and guardrails: route inventory, generated-interface test, import-boundary lint, Next.js lint rules, shared helpers extracted, duplicate PDF removed, this document | in progress |
| 2 | Relocate `app/`, `components/`, `lib/`, authored `data/*.ts` under `src/` (alias change), generated JSON stays | planned |
| 3 | Group `src/lib` by feature (profile, projects, insights, cv, jobs, applications, marketing, telemetry, tools) | planned |
| 4 | `scripts/` to `automation/`, shared Node/edge modules under `src/shared` | planned |
| 5 | Tests mirror features; tighten boundary lint; formatting check | planned |

**Acceptance for every step:** public URLs and generated-data contracts unchanged; static export and both Workers deploy; CV generation reproducible; lint, typecheck, unit, browser and relevant Worker tests pass.

# ADR 0002 — One repository, one package, feature-oriented structure

- **Status:** Accepted
- **Context:** The repository now contains a static Next.js site, shared domain code, scheduled automation pipelines, two Cloudflare Workers and generated data. `lib/` and `data/` have become catch-alls and some code is shared across pipelines by reaching into another pipeline's folder.

## Decision

Stay a **single repository and single npm package**. Organise by feature and by runtime, enforce dependency directions with lint, and migrate in small behaviour-preserving pull requests. See `docs/architecture.md` for the layout, rules and progress.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| npm/pnpm workspaces monorepo (site, workers, automation as packages) | Adds build orchestration, per-package tooling and deployment configuration for no present benefit: one lockfile, one CI and one deploy path already work, and most code is shared. Revisit if a part needs independent versioning or release. |
| Leave the layout alone | `lib/` and `data/` keep growing; cross-pipeline imports and Worker-to-Worker imports make ownership unclear and deployments brittle. |
| Move everything in one large PR | Unreviewable, and a mistake would be hard to localise. Mechanical steps are verified one at a time instead. |

## Consequences

- No public URL, generated data path, Wrangler binding or workflow contract changes as part of the restructuring; each is guarded by a test (route inventory, generated-interface table, cost guard).
- Each step updates `package.json`, Wrangler paths, Playwright and Vitest configuration, workflow path filters and docs in the same PR as the files they refer to.
- Generated files move only in a separately planned migration.

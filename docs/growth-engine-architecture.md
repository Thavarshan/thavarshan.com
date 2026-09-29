# Growth Engine architecture

## Purpose

The Growth Engine turns verified public/professional evidence into four coordinated pipelines: career intelligence, website acquisition/conversion, open-source distribution, and operational measurement. The existing Next.js site remains the public presentation layer and GitHub Actions remains the default batch/scheduled runtime.

## Operating model

1. **Verified data layer** — typed source data and generated JSON are the contract between collectors, automation, and UI.
2. **Career engine** — public job sources are collected, normalized, deduplicated, scored deterministically, and stored in `data/jobs.generated.json`.
3. **Application assistance** — private application artifacts are generated outside this public repository. Human review and submission remain mandatory.
4. **Growth/OSS engine** — Insights, project metadata, SEO pages, feeds, sitemaps, and reviewable marketing bundles create discoverable evidence rather than automated spam.
5. **Measurement** — privacy-conscious analytics and workflow summaries should measure high-intent actions and automation health.

## Runtime decisions

- **GitHub Actions first:** collection, scheduled refreshes, CV generation, repository mutation, marketing bundles, and weekly reports.
- **Static generation first:** public pages, SEO assets, feeds, and developer utilities that do not require request-time state.
- **Cloudflare/edge runtime is opt-in:** add it only when a concrete request-time or edge-scheduled requirement cannot reasonably be served by static generation or Actions.
- **Netlify remains the deployment target** until a migration has a measurable benefit. Do not introduce a second hosting platform only for architectural symmetry.
- **Docker is the reproducibility boundary** for tooling that requires system dependencies such as LaTeX.

## Generated-data safety

Generated public files may be committed directly to `main` when the workflow:
- validates external input at ingestion boundaries;
- runs relevant type, lint, test, and build checks before commit;
- avoids no-op commits;
- refuses suspicious destructive snapshots;
- preserves the last-known-good committed state when a run fails;
- uses a shared concurrency group when multiple workflows can push generated content.

Human-authored source changes continue through pull requests and CI.

## Privacy and secrets

- Public repository data must contain only intentionally public information.
- CV variants, cover letters, application state, credentials, tokens, and screening answers remain private.
- GitHub Actions secrets and deploy keys use least privilege.
- Logs and summaries must not echo private generated application content.
- External job descriptions and scraped content are untrusted text.

## Cost model

The baseline system must operate with repository code, GitHub Actions, static hosting/free tiers, and deterministic logic. Paid AI APIs are optional enhancements only. A feature cannot require a paid API to satisfy the Growth Engine's baseline definition of done.

## Failure and recovery

The committed repository snapshot is the last-known-good public state. Scheduled automation must fail closed: malformed inputs, source breakage, catastrophic count drops, or failed validation must not replace good generated data. Diagnostics may be uploaded as short-lived workflow artifacts.

## Growth Engine issue map

- #39 owns this operating contract and cross-cutting hardening.
- #40–#42 are existing capabilities and now track only remaining data/collector/scoring hardening.
- #43 remains a private review/dashboard decision; it must reuse the current job contract.
- #44 is deferred until a justified edge/runtime requirement exists.
- #45–#48 are the highest-value acquisition, distribution, measurement, and conversion work.
- #49 already has a private application-package implementation; remaining work is a deterministic $0 fallback and workflow/API reconciliation.
- #50 remains the consolidated weekly operational report.

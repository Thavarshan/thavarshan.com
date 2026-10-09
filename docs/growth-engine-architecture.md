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
  Two Workers exist, both on the Cloudflare Workers Free plan and guarded by `tests/integration/workers/worker-cost-guard.test.ts` (no paid bindings or compatibility flags):
  - `workers/job-review`: private, Access-gated review of job opportunities with review state in KV, because private writable state cannot live in the public static build (`docs/job-review-worker.md`, `docs/adr/0001-cloudflare-worker-for-private-job-review.md`).
  - `workers/site-metrics`: a public first-party event collector that stores daily aggregate counters in KV (`docs/measurement.md`).
  Both deploy from GitHub Actions; the static site still builds and deploys without either.
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

Closed (shipped):

- #39 operating contract and cross-cutting hardening (this document, `docs/cost-policy.md`).
- #40–#42 normalized job contract, hardened collectors and scheduled refresh, deterministic scoring (`docs/jobs-data.md`).
- #43 private review surface: the job-review Worker in `workers/job-review/` (`docs/job-review-worker.md`, ADR 0001). It reuses the job contract from `src/features/jobs/`.
- #44 edge-runtime evaluation: concluded with the same Worker plus the site-metrics Worker; Workers stay opt-in (see Runtime decisions).
- #45 developer tools as SEO pages (`docs/developer-tools.md`).
- #46 OSS distribution bundles (`docs/oss-marketing.md`).
- #47 zero-cost growth measurement (`docs/measurement.md`).

Open:

- #48 hiring/consulting conversion paths: implemented in the current focused PR, including the overlapping #59 journeys.
- #49 free deterministic application preparation shipped in PR #108 (`docs/applications-data.md`).
- #50 consolidated weekly operational report.
- #52–#67 SEO and marketing hardening.
- #80 and #81, the job-review Worker reliability follow-ups, are fixed and merged; #82 is this reconciliation.

Re-check this list against `gh issue list` when closing an issue so it does not drift again.

## Search visibility operations

Follow [the webmaster baseline](webmaster-baseline.md) for Search Console/Bing ownership, production build variables, sitemap submission, URL inspection and the 28-day measurement routine. The existing Deployment Smoke workflow runs `seo:webmaster` for production and retains a schema-versioned audit artifact. Technical eligibility, verification-tag presence, authenticated ownership and actual indexing are separate observations; never report rankings or indexed-page counts from a successful CI audit. Issue #50 can consume the public audit, while query/page opportunity prioritization remains #66.

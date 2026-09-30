# Laravel job opportunity dataset

`data/jobs.generated.json` is the versioned public job-intelligence snapshot used by this repository's automation and by any private review/application tooling.

## Scope

This repository owns public job discovery, normalization, deduplication, deterministic eligibility/scoring, and the orchestration that prepares private application-assistance packages. Private application state and generated application documents remain outside this public repository. There is no requirement for a separate Laravel application: any future private dashboard must justify itself against the existing Next.js + GitHub Actions architecture.

## Collection

Run:

```bash
npm run jobs:collect
```

The collector reads four public, no-auth sources, each isolated so one failing source never corrupts or blocks the others:

1. **LaraJobs RSS feed** (`https://larajobs.com/feed`) — structured per-item fields (`job:company`, `job:location`, `job:job_type`, `job:salary`, `job:tags`) are authoritative; the feed's own `<description>`/`<content:encoded>` are always blank in practice, so every LaraJobs listing's redirect target (`larajobs.com/job/{id}` always 302s to an arbitrary external destination — a company career page, an ATS, or occasionally an auth wall) is scraped for a real description, with bounded concurrency (4 at a time), retries, and a skip-list for known non-content auth-wall hosts (`accounts.google.com`, `docs.google.com`).
2. **Laravel News** (`https://laravel-news.com/`) — discovers LaraJobs links it currently features that aren't already known from the RSS feed, then scrapes each the same way as (1). Title and company come from Laravel News's own listing (never from the scraped page, whose `<h1>` may be a cookie banner or bot wall); the scrape only supplies description text, and anti-bot/challenge pages (Cloudflare "Additional Verification Required", "Just a moment…", etc.) are discarded rather than becoming a job.
3. **Remotive** (`https://remotive.com/api/remote-jobs?category=software-dev`) — a public JSON API that hosts full descriptions itself (no redirect-following needed). Remotive's own API response states a request-rate limit of roughly 4 requests/day; a daily cron is comfortably within that. Filtered to Laravel/PHP-relevant listings only — see the relevance note below.
4. **WeWorkRemotely** (`https://weworkremotely.com/categories/remote-programming-jobs.rss`) — a public RSS feed, also self-hosted content, same relevance filter.

Records are canonicalized and deduplicated by job URL within a source. Across sources, a normalized company+title fingerprint flags (non-destructively, via `duplicateOfIds`) opportunities that look like the same job posted on two different boards — both records are kept, never auto-merged or dropped, since a coincidental match is possible and losing a real distinct listing would be worse than an occasional duplicate flag.

**Relevance filtering** (Remotive, WeWorkRemotely): these are generalist multi-language boards, unlike LaraJobs. A listing is kept if its title (or Remotive's `category`) mentions Laravel/PHP, or if a *short* tag list (≤8 tags) mentions them. A long tag list is treated as an unreliable signal — some employers tag every one of their listings with their entire company-wide tech stack regardless of the specific role (e.g. a "Senior QA Engineer" post tagged with 40+ technologies including "laravel" purely because the company also happens to use it somewhere), and a bare tag match there would admit clearly irrelevant roles.

The collector does not sign in, bypass access controls, complete application forms, or submit applications.

After collection, type checking, linting, the job test suite, and a production build succeed, the scheduled workflow commits `data/jobs.generated.json` directly to `main`. If a source fails, the collector writes a diagnostic snapshot locally but exits non-zero, so the workflow does not commit that run. `.jobs-diagnostics/` output is uploaded as a workflow artifact. The job and profile refresh workflows share a concurrency group so they cannot push generated changes simultaneously.

## Fault isolation

A failure in one source never corrupts or discards data from the others, and never crashes the whole run:

- Each of the 4 sources is collected independently; a thrown error is caught, logged, and recorded to `.jobs-diagnostics/` (gitignored — CI-run scratch, never committed).
- A failed source's previously-collected opportunities are carried forward completely untouched (no status change) — they are neither refreshed nor lost.
- The snapshot is still written using whatever succeeded this run, and `sources[]` records each source's `status` (`ok`/`failed`), `error`, and per-run counts (`added`/`updated`/`closed`/`skipped`/`rejected`).
- If any source failed, the collector exits non-zero after producing local diagnostics. GitHub Actions therefore stops before the commit step and preserves the last-known-good repository snapshot.
- A structural sanity check (an HTTP-ok response that parses to zero raw items) throws rather than silently proceeding — a normally ~10-item feed returning nothing is a format break, not a legitimate empty result. A legitimate empty-after-relevance-filter result (e.g. WeWorkRemotely's current batch happening to have no Laravel/PHP roles today) is not an error. A second snapshot-level guard refuses publication when an established dataset (20+ open roles) suddenly collapses below 25% of its previous open-role count.

## Job lifecycle

Each opportunity has a minimal lifecycle — `status`: `new` (discovered this run) → `active` (seen again in a later run) → `closed` (its source no longer reports it, `closedAt` recorded). A closed opportunity is retained for 30 days (so it stays visible as recently-expired) then pruned entirely. This is intentionally a small subset of a fuller application-tracking lifecycle (applied/interviewing/offer/etc.) — those states belong to a later phase, not this collector.

## Ranking, eligibility, and categorization

Ranking is deterministic. It rewards Laravel, an appropriate seniority level, React/Vue/Inertia, cloud experience, explicit remote/APAC/Sri-Lanka language, and sponsorship mentions.

Every score is explainable: `scoreBreakdown` lists each `{ factor, points }` applied (baseline, positive signals, the −40 penalty for unresolved eligibility concerns, and the hard-exclusion cap). Points are summed then clamped to 0–100 and `reasons` are the positive factors. Snapshots written before this field existed parse with an empty breakdown until the next collection run.

`confidence` (0–100, `confidenceBreakdown`) is separate from fit: it scores how well-evidenced the extracted signals are (explicit eligibility +35, stated location +20, substantive description +20, stated seniority +15, tags +10, conflicting geography −25). It never changes `score`. It is `null` for snapshots written before it existed.

Relevance gate: a role must be demonstrably Laravel/PHP work to rank above `RELEVANCE_SCORE_CAP` (35). Evidence is the stack (Laravel/PHP/Livewire/Lumen/Symfony) in the title, 3+ mentions in the body after discounting marketplace-style "X & PHP" pairings, or a Laravel-only source board (LaraJobs). This stops agency postings that list every stack they staff (e.g. Lemon.io) from ranking on seniority/remote/cloud points alone. The cap is recorded in `scoreBreakdown` and the concern "Laravel/PHP is not central to this role".

Hard constraints outrank fit: an `ineligible` opportunity's score is capped at 20 (`INELIGIBLE_SCORE_CAP`) so technical-fit points can never outweigh a residency/work-authorization exclusion, and its `workArrangement` is `remote-regional-restricted` even if the posting also says "worldwide". Sponsorship is only `unavailable` (no bonus) on explicit wording such as "no sponsorship", "do not sponsor" or "unable to sponsor"; generic relocation wording never implies sponsorship. Regression fixtures live in `tests/unit/job-scoring.test.ts`.

`eligibility` is deliberately separate from match score:

- `eligible`: worldwide/APAC hiring, an explicit Sri Lanka mention, or confirmed sponsorship.
- `ineligible`: a country restriction conflicts with working from Sri Lanka and sponsorship is not confirmed.
- `unknown`: the role looks relevant but the posting does not establish that a Sri Lankan applicant can be hired.

`workArrangement` is a finer categorization derived from the same signals, alongside `eligibility`/`sponsorship` (not a replacement for them): `remote-worldwide`, `remote-sri-lanka-eligible`, `remote-regional-restricted`, `relocation-sponsorship`, `onsite-no-sponsorship`, `unknown`.

`salary`/`salaryMin`/`salaryMax`/`salaryCurrency`: the raw posted string is kept alongside a best-effort structured parse (range/point-figure/`k`-suffix/currency-symbol handling); a bare number never gets a guessed currency.

`unknown` must never be interpreted by the Laravel app as permission to apply automatically. Sponsorship and work authorization require job-specific evidence.

## Laravel consumer contract

The Laravel app should import the snapshot by immutable Git commit SHA, validate `schemaVersion` (currently `2` — bumped from `1` for the widened `source` enum and the new fields described above; there is no live consumer yet, so this was a clean cut rather than a staged migration), and upsert by `opportunities[].id`. It should retain its own application state instead of writing it back into this public file.

The JSON contains only public job information and matching signals. CV variants, cover letters, contact details, screening answers, credentials, and application history belong in the private Laravel application.

## Operational notes

- Treat descriptions as untrusted text.
- Attribute and link back to the original source.
- Stop the workflow when a source's format changes instead of silently emitting empty data (see Fault isolation above).
- Review source terms and selectors periodically, including for the two newer sources (Remotive, WeWorkRemotely).
- Playwright is intentionally limited to discovery. Application automation will use separate, explicitly supported connectors or manual handoff — and lives in a later phase, not this repository.
- The Laravel/PHP relevance filter for generalist boards is a heuristic (see Collection above); it can occasionally miss a relevant role or admit one that merely name-drops the keyword.

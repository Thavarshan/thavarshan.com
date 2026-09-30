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

After collection, snapshot validation (`npm run jobs:validate`), type checking, linting, the job test suite and a production build succeed, the scheduled workflow commits `data/jobs.generated.json` directly to `main`. It supports `workflow_dispatch`. The job and profile refresh workflows share a concurrency group so they cannot push generated changes simultaneously, and because pushes made with `GITHUB_TOKEN` do not trigger workflows (and this workflow has no `push` trigger) a generated commit can never re-trigger the collector.

**No-op commits.** A run rewrites the snapshot only when something material changed: a listing added/updated/closed/pruned/held, a source's health changed, or the collector version changed. Per-run bookkeeping (`generatedAt`, timings, `lastSeenAt` refreshes) does not count, so an unchanged day produces no commit. A heartbeat rewrite happens at least every 48 hours so `lastSeenAt` (which the empty-result grace period depends on) never goes stale.

**Observability.** Each run's job summary shows an overall health headline (healthy / degraded / all failed), a per-source table with status, **duration**, records, added/updated/closed/held/skipped/rejected, and whether the snapshot was rewritten and why. Durations are also stored per source in the snapshot (`sources[].durationMs`). Failures write `.jobs-diagnostics/` (error detail plus a screenshot for browser sources) and `health.json`, uploaded as an artifact; error text is reduced to a single clean line and no secrets are involved.

**Regression fixtures.** `tests/fixtures/jobs/sources/` holds real captured samples of each source's format (LaraJobs feed, WeWorkRemotely feed, Remotive API, Laravel News markup). Tests assert they parse, and that a changed format fails loudly (zero items / wrong shape) rather than yielding an empty snapshot. To refresh one after a deliberate format change, re-capture it (keep 2–3 records, at least one irrelevant to Laravel/PHP) and update the assertions.

## Source policy and politeness

Sources are chosen in the order API > RSS > structured HTML, and the collector **enforces** the constraints below in code (`automation/jobs/policy.ts`, `robots.ts`, `http.ts`); it does not rely on convention.

| Source | Method | robots.txt (checked 2026-09-30) | Constraints honoured |
| --- | --- | --- | --- |
| LaraJobs | RSS | `Disallow:` (allow all) | One feed request per run. Each listing's redirect chain is walked hop-by-hop with a robots.txt check on every host *before* it is requested. |
| Laravel News | structured HTML (home page listing) | disallows `/api/`, `/account/` | One page load per run; title/company taken from the listing, scrape used only for description text. |
| Remotive | public JSON API | **disallows `/api/*`** — see the exemption below | Attribution (link back + source name, kept via `source` and `canonicalUrl`); no re-submission to third-party job sites; no sign-up collection; ≤ ~4 requests/day (we make 1). |
| WeWorkRemotely | RSS | allows the category feed | One feed request per run. |

**robots.txt enforcement.** Before any request the collector fetches and caches `robots.txt` for the host (RFC 9309 semantics: agent groups, `Allow`/`Disallow`, `*` and `$`, longest match wins). A missing robots.txt (4xx) means allowed; a robots.txt that cannot be verified (5xx / network error) means **not allowed**. Disallowed URLs are never requested: a disallowed feed fails its source; a disallowed employer page just skips description enrichment (the listing is still recorded from board data).

**Documented exemption (needs owner sign-off).** Remotive's `robots.txt` disallows `/api/*`, yet `https://remotive.com/api/remote-jobs` is Remotive's documented public API, and its own response states that access "is granted so that developers can share our jobs further" under the conditions above. `sourcePolicies.remotive.robotsExemptions` allows exactly that endpoint (nothing else on the host), with the justification in code. Delete that one entry to make the collector obey robots.txt strictly; Remotive would then fail as a source and its data would simply stop refreshing.

**Politeness and bounds.** Every request carries the explicit `User-Agent` `JeromeJobCollector/1.0 (+https://thavarshan.com)`; requests to the same host are spaced ≥ 1 s apart; each request has a 30 s timeout with bounded retries; enrichment concurrency is 4; each source has a 6-minute wall-clock deadline and the collect step 12 minutes (job limit 20). No authentication, CAPTCHA solving or crawling beyond the links a source itself publishes.

**Scrape quality guards.** Scraped pages that are bot walls, challenge pages or region blocks ("Careers are not available in your region") are discarded rather than stored, and a description only counts as *changed* when its word content differs materially (Jaccard similarity < 0.85), because real pages carry viewer-specific noise (IP-geolocation blobs, time-zone-converted deadlines). Single-page ATS sites get a bounded wait for network idle so a loading shell is not captured as the posting.

## Fault isolation

A failure in one source never corrupts or discards data from the others, and never crashes the whole run:

- Each of the 4 sources is collected independently; a thrown error is caught, logged, and recorded to `.jobs-diagnostics/` (gitignored — CI-run scratch, never committed).
- A failed source's previously-collected opportunities are carried forward completely untouched (no status change) — they are neither refreshed nor lost.
- The snapshot is still written using whatever succeeded this run, and `sources[]` records each source's `status` (`ok`/`failed`), `error`, and per-run counts (`added`/`updated`/`closed`/`skipped`/`rejected`).
- **Partial failure still publishes what succeeded.** If some sources fail, the healthy sources' fresh data is written and committed (failed sources' listings are carried forward untouched), and the workflow's final step then fails the run so the problem is visible (red run + job summary + `jobs-collector-diagnostics` artifact). If **every** source fails, or the snapshot-collapse guard trips, nothing is written and the collector exits non-zero, leaving the last-known-good file in place.
- **Empty-result guard** (see "Source health: empty-result guard") holds recently-seen listings when a source unexpectedly returns nothing.
- A structural sanity check (an HTTP-ok response that parses to zero raw items) throws rather than silently proceeding — a normally ~10-item feed returning nothing is a format break, not a legitimate empty result. A legitimate empty-after-relevance-filter result (e.g. WeWorkRemotely's current batch happening to have no Laravel/PHP roles today) is not an error. A second snapshot-level guard refuses publication when an established dataset (20+ open roles) suddenly collapses below 25% of its previous open-role count.

## Job lifecycle

Each opportunity has a minimal lifecycle — `status`: `new` (discovered this run) → `active` (seen again in a later run) → `closed` (its source no longer reports it, `closedAt` recorded). A closed opportunity is retained for 30 days (so it stays visible as recently-expired) then pruned entirely. This is intentionally a small subset of a fuller application-tracking lifecycle (applied/interviewing/offer/etc.) — those states belong to a later phase, not this collector.

## Ranking, eligibility, and categorization

Ranking is deterministic. It rewards Laravel, an appropriate seniority level, React/Vue/Inertia, cloud experience, explicit remote/APAC/Sri-Lanka language, and sponsorship mentions.

Every score is explainable: `scoreBreakdown` lists each `{ factor, points }` applied (baseline, positive signals, the −40 penalty for unresolved eligibility concerns, and the hard-exclusion cap). Points are summed then clamped to 0–100 and `reasons` are the positive factors. Snapshots written before this field existed parse with an empty breakdown until the next collection run.

`confidence` (0–100, `confidenceBreakdown`) is separate from fit: it scores how well-evidenced the extracted signals are (explicit eligibility +35, stated location +20, substantive description +20, stated seniority +15, tags +10, conflicting geography −25). It never changes `score`. It is `null` for snapshots written before it existed.

Relevance gate: a role must be demonstrably Laravel/PHP work to rank above `RELEVANCE_SCORE_CAP` (35). Evidence is the stack (Laravel/PHP/Livewire/Lumen/Symfony) in the title, 3+ mentions in the body after discounting marketplace-style "X & PHP" pairings, or a Laravel-only source board (LaraJobs). This stops agency postings that list every stack they staff (e.g. Lemon.io) from ranking on seniority/remote/cloud points alone. The cap is recorded in `scoreBreakdown` and the concern "Laravel/PHP is not central to this role".

Hard constraints outrank fit: an `ineligible` opportunity's score is capped at 20 (`INELIGIBLE_SCORE_CAP`) so technical-fit points can never outweigh a residency/work-authorization exclusion, and its `workArrangement` is `remote-regional-restricted` even if the posting also says "worldwide". Sponsorship is only `unavailable` (no bonus) on explicit wording such as "no sponsorship", "do not sponsor" or "unable to sponsor"; generic relocation wording never implies sponsorship. Regression fixtures live in `tests/unit/jobs/job-scoring.test.ts`.

`eligibility` is deliberately separate from match score:

- `eligible`: worldwide/APAC hiring, an explicit Sri Lanka mention, or confirmed sponsorship.
- `ineligible`: a country restriction conflicts with working from Sri Lanka and sponsorship is not confirmed.
- `unknown`: the role looks relevant but the posting does not establish that a Sri Lankan applicant can be hired.

`workArrangement` is a finer categorization derived from the same signals, alongside `eligibility`/`sponsorship` (not a replacement for them): `remote-worldwide`, `remote-sri-lanka-eligible`, `remote-regional-restricted`, `relocation-sponsorship`, `onsite-no-sponsorship`, `unknown`.

`salary`/`salaryMin`/`salaryMax`/`salaryCurrency`: the raw posted string is kept alongside a best-effort structured parse (range/point-figure/`k`-suffix/currency-symbol handling); a bare number never gets a guessed currency.

`unknown` must never be interpreted by the Laravel app as permission to apply automatically. Sponsorship and work authorization require job-specific evidence.

## Schema versioning and migration

The contract lives in `opportunitySnapshotSchema` (`src/features/jobs/opportunities.ts`); loading, migration and validation of untrusted snapshot JSON go through `loadSnapshot` (`src/features/jobs/snapshot.ts`).

- **Additive changes** (a new optional/defaulted field) do **not** bump `schemaVersion`; they ship with a zod default so older snapshots keep loading (this is how `scoreBreakdown`, `confidence` and `confidenceBreakdown` were added).
- **Breaking changes** (removing/renaming a field, narrowing an enum, making a field required) bump `schemaVersion`, add a `migrate` step in `src/features/jobs/snapshot.ts`, and add a fixture of the previous version under `tests/fixtures/jobs/`. `snapshot-v1.json` is a real v1 snapshot from git history; the v1 → v2 migration derives the newly required fields (`workArrangement`, `seniority`, salary parts, `contentFingerprint`, `status`) from stored text and preserves stored `id`, `score` and `eligibility`.
- **Refusal, never reset:** a snapshot that is corrupt, fails validation after migration, or has a *newer* `schemaVersion` than the code raises `SnapshotError`. The collector then **fails the run** and leaves the committed file untouched (the last-known-good state) instead of starting fresh, which would discard history and bypass the collapse guard. Deliberately starting over requires `JOBS_RESET_SNAPSHOT=1`.
- **CI:** `npm run jobs:validate` fails unless the committed snapshot is valid at the current version with unique ids, so a bad generated commit is caught on the next PR/push.
- **Recovery:** the committed `data/jobs.generated.json` in git is the recovery point (`git checkout <sha> -- data/jobs.generated.json`); writes are atomic (temp file + rename), and a run that fails leaves the previous file in place.

### Data contract coverage

Every field below is populated from real source data or deterministic extraction, and is an explicit `null` / empty / `unknown` when a posting does not say. All were added as defaulted, additive fields (no `schemaVersion` bump), so older snapshots load unchanged.

| Contract field | Where it lives |
| --- | --- |
| stable ID | `id` — sha256 of the canonicalized URL |
| source / source ID | `source` + `sourceId` (LaraJobs job number, WeWorkRemotely slug, Remotive job id) |
| canonical URL | `canonicalUrl` (tracking params stripped) |
| title, company | `title`, `company` |
| description excerpt / hash | `descriptionText` (capped at 12,000 chars) + `descriptionHash` (whitespace/case-insensitive; drives "updated" detection) |
| technologies | `tags` |
| seniority, employment type | `seniority`, `employmentType` |
| compensation min/max/currency/period | `salary` (raw) + `salaryMin`/`salaryMax`/`salaryCurrency` + `salaryPeriod` (only when explicitly stated; a bare `$100k` is never assumed annual) |
| raw location | `location` |
| normalized countries / regions | `countries` (ISO 3166-1 alpha-2) and `regions` (`worldwide`, `emea`, `apac`, `europe`, `north-america`, `latam`, `asia`) — geography the posting **names**, taken from the title/location and eligibility phrases (not incidental prose). Named is not eligible; eligibility is decided separately |
| timezone constraints | `timezones` (`UTC+1`, `GMT-5`, `EST`, `CET`, …) as written in the posting |
| remote scope | `workArrangement` |
| visa sponsorship / relocation support | `sponsorship` and, independently, `relocation` (`offered` / `unavailable` / `unknown`) |
| application URL | `applicationUrl` — the employer/ATS page a board redirects to (LaraJobs and Laravel News); http(s) only, board and auth-wall hosts rejected; otherwise `null` and `canonicalUrl` is the listing |
| first/last seen, posted | `firstSeenAt`, `lastSeenAt`, `publishedAt` |
| expiry | `status`/`closedAt` (set when a listing disappears). **No source provides an expiry timestamp** — checked against the LaraJobs feed, the WeWorkRemotely RSS and the Remotive API (2026-09-30) — so no field is modelled for it |
| source evidence | `reasons`, `concerns`, `scoreBreakdown`, `confidenceBreakdown` (scoring evidence, not per-field provenance) |
| collector version / schema version | snapshot-level `collectorVersion` (bump `COLLECTOR_VERSION` in `src/features/jobs/opportunities.ts` whenever collection/derivation logic can change stored values) and `schemaVersion` |

### Source health: empty-result guard

A source can "succeed" but return nothing when its filter or parser breaks. If a source that had at least 3 active listings returns zero, listings **seen within the last 72 hours are held open** instead of closed (`held` in the source stats, a warning in the log, and a "Held" column in the run summary). A source that is genuinely empty still clears once the grace window lapses. This complements the global guard that refuses a snapshot whose open count collapses by more than 75%.

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

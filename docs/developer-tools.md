# Developer tools (SEO acquisition pages)

Small, private, deterministic Laravel/PHP utilities that earn search traffic by solving real problems (issue #45). They are part of the static Next.js export, so they cost nothing to host or run.

- `/tools` — index
- `/tools/laravel-scheduler-cron` — cron expression → plain English, exact Laravel scheduler call, next run times
- `/tools/laravel-env-checker` — compare `.env` and `.env.example`, find what breaks a Laravel boot

## Why these two

Selection criteria from the issue: Laravel/PHP relevance, search usefulness, runs client-side, low maintenance, demonstrates engineering quality.

| Tool | Relevance / search demand | Client-side | Maintenance | Engineering signal |
| --- | --- | --- | --- | --- |
| Scheduler cron helper | Every Laravel app with a scheduler; people search for "laravel schedule every N minutes" / cron-to-`Schedule` translations | Pure functions, no I/O | Low: cron and Laravel's helper set change rarely | A property test proves every suggested helper reproduces the input schedule exactly; DST-aware next-run maths |
| `.env` checker | Recurring Laravel pain (missing keys, spaces in values, empty `APP_KEY`, `APP_DEBUG` in production) | Pure functions, and **must** be client-side because the input is secrets | Low: follows phpdotenv's stable parsing rules | Privacy is provable in tests (see below) |

Considered and deferred: a PHP `date()` format tester and a Composer version-constraint tester. Both are good candidates for a later PR; the issue asks for 2–3 tools and explicitly warns against padding with thin pages.

## Guarantees

**Privacy (the `.env` checker in particular).** All logic lives in `src/features/tools/*` (pure functions) and runs in the browser. Nothing is uploaded, logged, or stored (no cookies, `localStorage`, `sessionStorage`, or URL state). Findings and the copyable report contain key names and line numbers only, never values; the "missing keys" block copies an example default only when it is clearly not sensitive. This is enforced by tests:

- unit: sentinel secrets fed into every field never appear in findings, the report, or the missing-keys block (`tests/unit/tools/tool-env-check.test.ts`);
- end-to-end: a real browser session records **every network request** while a sentinel secret is typed and asserts it appears in none of them (URL or body), nor in results, storage, cookies or the page URL (`tests/e2e/tools.spec.ts`).

Analytics only counts button clicks via Plausible tagged-event classes: `Tool Example Load` and `Tool Copy Output`. No input, output or file content is ever an event property. The site-wide analytics remain cookie-free (see `/privacy`).

**Correctness.** Suggestions are only shown when provably equivalent; otherwise the tool says so and falls back (`->cron()`). Known behavioural limits are listed on each page and in `src/features/tools/*` (unsupported cron tokens are reported, not mis-evaluated; when both day fields are set the classic OR behaviour is shown with a warning because Laravel's cron library does not document that case).

**Robustness.** Inputs are size-limited (256,000 characters / 5,000 lines) with clear errors; hostile input never throws (tested); all output is rendered as escaped text by React.

**Accessibility.** Native labelled controls, keyboard-operable buttons, `aria-live` result regions, errors as `role="alert"`, severity conveyed by text and icon rather than colour alone, visible focus outlines, tables with captions and scoped headers. Lighthouse CI asserts accessibility ≥ 0.95 on all three tool routes (`.lighthouserc.json`).

## SEO

Each page has a unique title and description, a canonical URL, OpenGraph/Twitter metadata with a generated social image, `WebApplication` + `BreadcrumbList` structured data, a sitemap entry, and substantial unique content (why it exists, how it works, examples, limitations, privacy, FAQ) plus internal links to the related project and Insights pages. Tools are linked from the site navigation and footer.

## Adding a tool

1. Put the logic in `src/features/tools/<name>.ts` as pure functions with unit tests, including malformed input and (if it handles secrets) a value-never-leaks test.
2. Add the component in `src/features/tools/components/` (client component; no persistence; labelled controls; `aria-live` results).
3. Add an entry to `src/features/tools/registry.ts` (unique content is required, not optional) and map its slug in `src/app/tools/[slug]/page.tsx`.
4. Add e2e coverage to `tests/e2e/tools.spec.ts` and the URL to `.lighthouserc.json`.
5. Sitemap, index, social image and structured data are generated from the registry.

## Cost

Static pages and client-side JavaScript on the existing Netlify site: no server, function, database or paid API. See `docs/cost-policy.md`.

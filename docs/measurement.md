# Growth measurement ($0, privacy-first)

Answers one question: *which free acquisition work leads to high-intent actions?* (issue #47). It is a first-party, cookie-free event layer with weekly aggregate snapshots. It needs **no paid analytics plan**: Plausible Cloud is paid, so it stays an optional extra sink, and the site measures perfectly well without it.

```
visitor action ─▶ browser track() ─▶ collector Worker ─▶ KV: one daily counter ─▶ weekly snapshot ─▶ data/growth/
                     │  (DNT/GPC: does nothing)   (validates, stores aggregates only)        (committed, comparable)
                     └─▶ window.plausible (only if configured)
```

## Model: acquisition → engagement → intent

- **Acquisition is not an event.** It is the attribution attached to every event: `utm_source` / `utm_medium` / `utm_campaign` from the landing URL, else a coarse **referrer class** (`direct`, `search`, `social`, `code`, `community`, `internal`, `other`). Campaign names come from the bundles in `marketing/oss/` (`withUtm`), so a post can be traced to the actions it caused.
- **Engagement** (interest): profile visits, reading most of an Insight, newsletter clicks.
- **Intent** (a step toward hiring, collaborating or adopting): repository/demo clicks, CV downloads, contact/hire/consulting CTAs, completing a developer tool, copying its output.

## Event taxonomy

Defined once in `src/features/telemetry/events.ts` and shared by the browser, the collector and the snapshot job; a test fails if this table omits an event.

| Event | Stage | Properties | Fired when |
| --- | --- | --- | --- |
| `repo_click` | intent | `project` | a project's repository/package link is clicked |
| `demo_click` | intent | `project` | a project's demo or documentation site is clicked |
| `cv_download` | intent | `location` | the CV link is clicked |
| `contact_cta` | intent | `location` | an email/contact call to action is clicked |
| `hire_cta` | intent | `location` | a hiring CTA is clicked (reserved for #48) |
| `consulting_cta` | intent | `location` | a consulting CTA is clicked (reserved for #48) |
| `tool_completed` | intent | `tool` | a developer tool produced a result (once per page view) |
| `tool_output_copied` | intent | `tool` | a tool's output was copied |
| `profile_click` | engagement | `network` (`linkedin`/`github`) | an external profile link is clicked |
| `insight_read` | engagement | `slug` | 75% of an Insight was scrolled (once per page view) |
| `newsletter_click` | engagement | none | a newsletter link is clicked |

Every property is an enum or a short lowercase slug, so there is **nowhere to put free text, form contents, secrets or an identifier**. Adding an event means adding it to `EVENTS`; the collector rejects anything else.

## What is collected, and what is not

Stored per (UTC day, event, page path, utm source/medium/campaign, referrer class, allowed properties): **one integer counter**. Kept 400 days (about 13 months), then expired automatically.

Never collected or stored: IP address, user agent, cookies, visitor/session identifiers, fingerprints, timestamps finer than a day, page views, the full referrer URL or query strings, anything typed into a tool. The client IP is used only as an in-memory rate-limit key and is never persisted or logged; logs carry the outcome and a request id only.

Browser-side rules (`src/features/telemetry/client.ts`):
- **Do Not Track and Global Privacy Control are honoured completely**: nothing is sent and nothing is written to storage.
- No cookies, no `localStorage`. The only storage is a four-string landing-attribution record in `sessionStorage` (utm source/medium/campaign and referrer class) so a later click in the same tab is credited to how the visitor arrived; it dies with the tab.
- UTM values are attacker-controlled (anyone can craft a link), so they are lowercased and allowlisted; invalid values are dropped.
- Fire-and-forget via `sendBeacon` (as `text/plain`, so no CORS preflight), falling back to `fetch keepalive`. **Blocked, offline or throwing analytics is invisible to the visitor.**
- Double clicks within a second are dropped; "completed" style events fire once per page view.

## Unknown attribution is reported as unknown

The weekly snapshot separates attributed actions (a campaign or a non-direct referrer class) from **unattributed** ones (direct visits, copied links, stripped referrers) and reports the unattributed share. It never assigns unknown traffic to a channel. Page views are not collected, so **rates cannot be computed**; the snapshot says so. Every number is a lower bound (DNT/GPC users, blockers and no-JS visitors are not counted). The collector accepts unauthenticated events from the site origin, so counts are indicative rather than audited.

## Weekly snapshots

`.github/workflows/growth-metrics.yml` runs each Monday (and on demand) and commits `data/growth/<ISO-week>.json` plus `latest.json`. Each contains totals by stage and event, actions by referrer class and by campaign, intent by project/tool/location, top pages, Insights read, coverage (days with data), a week-over-week comparison, and plain-language caveats. The job summary renders the same table. It reads the aggregates through Cloudflare's API with the existing deploy secrets, reads at most 5,000 keys per run, and skips cleanly (writing nothing) when the secrets are absent.

```bash
npm run growth:metrics -- --dry-run                       # last completed ISO week, print only
npm run growth:metrics -- --start 2026-09-21 --end 2026-09-27
npm run growth:metrics -- --dry-run --input rows.json      # offline, from exported rows
```

## Components

| Piece | Where |
| --- | --- |
| Taxonomy, validation, aggregate keys | `src/features/telemetry/events.ts` |
| Browser layer | `src/features/telemetry/client.ts`, `src/features/telemetry/telemetry-provider.tsx`, `src/features/telemetry/goals.ts` |
| Collector Worker (Free plan, KV only) | `workers/site-metrics/` — `POST /collect`, `GET /healthz` |
| Snapshot builder and CLI | `src/features/telemetry/snapshot.ts`, `automation/growth/metrics-snapshot.ts` |
| Deploy (CI only) | `.github/workflows/site-metrics-deploy.yml` |

The endpoint is `site.metricsUrl` in `src/features/profile/site.ts` (empty disables first-party telemetry); the site's CSP `connect-src` allows it. The optional Plausible sink activates only if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set, and receives the same typed events.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| Collector down, blocked, or over the Free plan's limits | The event is dropped; the site is unaffected. The collector answers 503 for storage errors. |
| Someone floods the endpoint | Per-isolate rate limit (120/min/client) and strict validation; worst case the Free plan's daily limits are reached (requests fail; **no charge is possible**) and counts are polluted for that day. |
| KV write limit (1,000/day on Free) | Further events that day are dropped. Only intent/engagement actions are sent (no page views), so normal traffic is far below the limit. |
| Snapshot job fails | The previous snapshots remain; nothing partial is written (`writeJsonAtomic`). |
| Bad or forged keys in KV | Ignored, never trusted (strict re-validation when reading). |

Recovery: delete the Worker or remove `site.metricsUrl` to stop collection instantly; committed snapshots are unaffected.

## Cost

$0. Cloudflare Workers Free + KV Free (allowlisted by `tests/integration/workers/worker-cost-guard.test.ts`), GitHub Actions free minutes on a public repository, no paid analytics. See `docs/cost-policy.md`.

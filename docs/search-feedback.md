# Private search-performance feedback

Issue #66 extends the existing Monday Growth Engine Health workflow with private
search analysis. It uses no AI, paid SEO service, database or new dependency.
Search Console ownership verification and API authorization are separate steps.

## Activate automated Google collection

1. In a Google Cloud project, enable **Google Search Console API**. Create a
   dedicated service account for this read-only collector; do not enable billing,
   BigQuery exports or unrelated paid services.
2. Download a JSON service-account key. In Search Console's **Settings → Users
   and permissions**, grant its `client_email` access to the verified property.
   Use the least privilege that permits performance reads; no ownership transfer,
   Gmail permission or domain-wide delegation is required.
3. Save the complete JSON as the website repository's Actions secret
   `GOOGLE_SEARCH_CONSOLE_CREDENTIALS`. Never commit it or paste it into an issue.
4. Set Actions variable `GOOGLE_SEARCH_CONSOLE_PROPERTY` to the exact verified
   property: `https://thavarshan.com/` (default) or `sc-domain:thavarshan.com`.
5. Reuse the existing `APPLICATIONS_REPO_DEPLOY_KEY` and optional
   `APPLICATIONS_REPO_SLUG`. Confirm that destination remains private. Its deploy
   key is scoped to that repository; no public Actions token is used for private
   storage. The collector cannot certify repository visibility from an SSH key.
6. Run **Growth Engine Health** manually from `main`, with notification disabled
   for the first diagnostic run. Check the search step and the private files below.
   A green website CI run does not establish successful Google authorization.

Only `webmasters.readonly` is requested. Collection is bounded to one token exchange
and six sequential analytics requests, with fixed Google endpoints, no redirects,
10-second timeouts, 2 MiB responses and no automatic retries. Token/response/error
bodies are never printed. Revoke/rotate the service-account key to disconnect.
If organization policy disallows service-account keys, use private exports instead;
do not weaken that policy to activate this feature.

## Data contract

Private files are under `search-performance/` in the existing private destination:

| File | Role |
| --- | --- |
| `google.json` | Validated collected aggregate input |
| `bing.json` | Optional owner-normalized Bing input, analyzed separately |
| `google-indexing.json`, `bing-indexing.json` | Optional dated Page Indexing observations |
| `<source>-report.json` | Metrics, evidence, caveats and bounded recommendations |
| `<source>-summary.md` | Concise private weekly readout |
| `<source>-content-plan.json` | Prioritized evidence-backed tasks requiring human review |

`searchSnapshotSchema` in `automation/growth/search/model.ts` is the strict input
contract. Version 1 requires source (`google`/`bing`), property, collection timestamp,
search type `web`, all-country/all-device filters, timezone, and
`coverage: "partial-top-rows"`. Both `current` and `previous` contain `start`, `end`,
independent property `totals`, `pages` and `queries`. Periods are contiguous and
exactly 28 days each. Google uses Pacific dates, excludes the three most recent
days, and requests finalized data. Keep Bing's export date boundaries explicit
(`UTC` or Pacific); do not silently relabel timezone or combine providers.

Each metrics object contains `clicks`, `impressions` and `position`. Page rows
contain `page` and `metrics`; query rows also contain `query`. URLs must be literal
canonical HTTPS URLs without tracking parameters/fragments. Only aggregates are
accepted: unknown fields, identifiers, dimensions or filter changes are rejected.
`totals: null` means no observed aggregate row, not verified zero traffic. A genuine
zero-impression metrics row has zero clicks and `position: null`; CTR is undefined.
At most 1,000 rows per table are accepted. Property totals are independent of
page/query tables and must not be obtained by summing those rows. Domain-property
totals can cover aliases while canonical page/query analysis excludes them.

The Search Analytics API returns top rows and can omit anonymized queries. Missing
prior rows do not establish zero historical traffic. The report intentionally
labels such queries **newly observed**, rather than claiming newly created demand.

Indexing input is optional:

```json
{
  "schemaVersion": 1,
  "source": "google",
  "observations": [
    { "date": "2026-10-01", "indexedPages": 10 },
    { "date": "2026-10-08", "indexedPages": 12 }
  ]
}
```

Record actual Page Indexing observations, with dates; never substitute sitemap
counts or successful URL live tests. Missing indexing input stays unknown.
Observations are capped at 32 and the latest two are compared without forecasting.

## Deterministic review policy

| Signal | Evidence threshold | Suggested review |
| --- | --- | --- |
| Declining page | Prior ≥10 clicks/100 impressions; loss ≥5 clicks and ≥20% | Check indexing/seasonality, refresh evidence and links |
| Low CTR | ≥100 impressions, CTR <2%, position ≤20 | Review title/snippet against actual intent |
| Position 8–20 | Page/query ≥50 impressions | Improve useful coverage and contextual links |
| Newly observed query | ≥50 impressions; absent from prior top rows | Validate intent; improve existing page before proposing new content |

These are review heuristics, not universal benchmarks or causal claims. Queries
containing the name tokens `Jerome` or `Thavarshan` are labeled branded; all others
are labeled non-branded by this explicit heuristic. Known URLs are checked against
the current public project/Insight/tool registry. Unrecognized routes receive
technical canonical/redirect review before any content task. Scores, thresholds,
sorting and a 20-task cap are version controlled. Data older than ten days at the
period end produces no current recommendations. Low volume can legitimately
produce no actionable tasks; average position is context, not a ranking promise.

## Public report and content refresh

The search job publishes only `{ "schemaVersion": 1, "status": "available" }`
(or `no-data`, `stale`, `unavailable`, `failed`) as an Actions artifact. The public
health report/email reads that strict allowlist, includes no search counts, query
strings, private links or recommendations, and keeps indexing unknown. If search
collection fails, the job fails visibly while the independent public report still
runs. Detailed weekly opportunities belong in the private summary.

Content Refresh reads the stored private aggregates through
`npm run growth:search -- --content-plan`, revalidates freshness and evidence, and
loads the priority queue into ignored `.search-feedback/content-plan.json`. It
does not edit or publish public content automatically. This provides a bounded
input for future editorial automation (#61); human review is required today.
Private plans are never uploaded as Actions artifacts, printed in summaries,
passed to public commit helpers, or included in the static export.

For private offline inspection, run
`npm run growth:search -- --input /absolute/path/to/normalized-input.json`.
Report, Markdown summary and content plan are written to ignored
`.search-feedback/`. No network or publication occurs in this mode.

## Recovery and evidence

All sources validate before private files change. Collection/validation failures
preserve the last committed private state. Private pushes never force/rebase;
concurrent changes or storage failures fail rather than claim publication. Partial
local writes are discarded with the temporary private clone. Symlink inputs and
output files are rejected. Missing credentials/data are explicitly unavailable.

Fixture tests cover authentication, endpoint bounds, JWT scope/signature, quotas,
date boundaries, aggregation, malformed inputs, deterministic priorities, private
publication and public projection. Production activation needs the owner's Google
credential/property grant and a successful live run; fixture CI does not prove it.

Sources: [Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[service-account authorization](https://developers.google.com/identity/protocols/oauth2/service-account),
[Search Console export limits](https://support.google.com/webmasters/answer/12919797),
[query privacy and top-row limits](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive).

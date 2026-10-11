# Evidence-based publishing and refresh

Use the existing Insights, developer tools, project pages, RSS/IndexNow and Monday Growth Engine report. No posting quota, paid service, AI dependency or second publishing system is introduced. A useful reviewed improvement takes priority over a new article.

## Content standards

| Type | Original contribution and evidence required | Review trigger |
| --- | --- | --- |
| First-hand Insight | Owner-confirmed decision/account, trade-offs, failure cases and links to public source or reproducible examples; distinguish advice from measured results | Changed evidence or 180 days since review |
| Developer tool | Working tested implementation, exact version/behavior, useful examples, privacy and explicit limits | Source/API change or 90 days |
| Project case study | Actual repository/profile evidence; explain role and decisions; measurements need dated evidence and permission to publish | Description/README/template change or 180 days |
| Release note | Actual tagged release/changelog and version/date; explain changes without invented adoption or impact | Each relevant release; older claims on the corresponding project reviewed within 180 days |
| Troubleshooting/reference | Reproduced problem, environment/version, verified steps, failure paths and limitations; primary documentation where needed | Source/version change or 180 days (90 days for interactive tools) |

Homepage/CV have 90-day review intervals; collection pages 180 days; privacy 365 days. These are editorial operating deadlines, not guarantees of accuracy, search freshness or ranking. Shared source/template changes can flag multiple pages and need a human to decide relevance. Code-only upstream changes that do not alter imported public descriptions/excerpts require the owner's version-sensitive review; the source hash does not crawl upstream repositories or documentation.

## Before publishing

Start with `marketing/content-brief-template.md` and the #54 intent map. Review the existing destination before proposing another page. Answer one clear user task, with an original example or first-hand lesson. Record the evidence, date/version, limitations and the difference between observation and recommendation. Review private search evidence privately; public briefs contain only a private report/task reference, never its query or metric values.

Check title, description, H1, useful answer/tool, incoming/outgoing internal links, appropriate CTA, visible evidence supporting structured data, canonical URL and sitemap/RSS applicability. Test examples/tools, accessibility, mobile layout, image semantics and relevant rendered SEO. Do not invent first-hand incidents, client results, ratings, certifications or numerical outcomes. AI may draft, but cannot approve facts or publish narrative; the owner reviews every changed public claim before merge. Unsupported content remains a draft or is omitted. `getAllInsights()` already excludes drafts from public discovery.

The generated-publication helper only accepts the specific snapshot/CV, OSS-draft, aggregate metrics and health-baseline paths appropriate to its purpose. It refuses a pre-staged index and validates staged files before committing. Articles, page source, profile claims, positioning and review approvals cannot pass that helper. This is a staging boundary, not a semantic verifier of every third-party repository description; snapshot changes still require review and CI. The existing job publisher separately validates its own generated job snapshot. No automated process changes editorial review records.

## Weekly operating cadence

Monday Content Refresh (08:47 Asia/Colombo) reads the last fresh private search priorities and records public content-review signals after refreshing snapshots. It can use the previous Monday's search window; freshness is validated by #66 and stale inputs contribute no current search tasks. It proposes only its existing generated snapshot/CV changes. The private ignored content plan now includes public review flags and the page intent/audience/CTA context alongside validated private source tasks. It is never uploaded or committed publicly.

Monday Growth Engine Health (11:15 Asia/Colombo) collects the latest private search feedback and sends the existing public report through #114. Public output lists canonical pages with unreviewed/overdue/source-changed flags and the age of their public source dates. Insight/tool dates represent published or substantively modified content; profile dates represent the profile snapshot; project dates represent upstream repository activity and are not editorial approval. Search tasks, queries, metrics and their counts stay private. A collector failure produces unknown review status in the health report rather than a clean result; a Content Refresh review failure stops that refresh before publication.

After the report, the owner inspects fresh private source plans and the public review queue. Prioritize: factual/version/privacy errors first; then a fresh evidence-backed search opportunity on a relevant existing page; then changed-source or overdue pages; then a distinct new topic with original evidence. Choose one focused task that can be verified. No qualifying task means explicitly defer; do not manufacture content to satisfy a schedule. The public report does not establish that a high-opportunity search task exists; inspect the private plan to determine that.

Once a month, compare the available search windows and first-party actions, noting missing coverage, anonymized/top-row limits and seasonality. Avoid attributing all changes to a particular edit. Revisit the intent map if observed questions and page usefulness warrant it, rather than expanding a keyword list. Never copy private measurements into a public monthly summary without separate authorization.

## Review records and recovery

`marketing/content-review-state.json` stores public-source digests and optional owner review dates. Calendar review dates and age boundaries use Asia/Colombo; generated report timestamps remain UTC. Initial `capturedAt` is a technical baseline; every `reviewedAt` is null. `npm run content:review` writes only ignored `test-results/content-review/` signals, never the state file or page content. `npm run growth:health -- --offline` includes the same public signals without network access.

After the owner completes an actual review, update that page's `sourceDigest` to the current value and `reviewedAt` to the review date in a normal reviewed PR. Obtain current digests locally with:

```sh
node --import tsx --input-type=module -e 'import { publicSourceDigests } from "./automation/marketing/content-review.ts"; console.log(JSON.stringify(await publicSourceDigests(), null, 2));'
```

This prints only paths and hashes of public evidence. A reviewed date alone does not clear a source-change signal: update the digest only after inspecting the change. Snapshot `syncedAt`, repository stars/forks/update timestamps and profile import provenance do not trigger editorial review. Authored descriptions, README excerpts, profile evidence, tools and page templates do. New mapped pages without records are unreviewed/source-changed until reviewed; remove obsolete records when intentionally retiring a page.

Do not bump article `updatedAt` just because a schedule ran or an article was inspected. Change it when substantive content/evidence actually changes. RSS keeps original article publication dates while its build date and sitemap collection modification use the latest actual article modification. New published articles enter the existing sitemap/RSS automatically; new tools/projects enter the sitemap through their current registries. Update #54 mapping and the existing URL lifecycle register for new public pages; required CI catches omissions.

Malformed/future/duplicate records or missing evidence produce unavailable signals, never approval. Restore the last valid state from Git and inspect the cause. To remove the feature, revert its PR; existing public pages and private search collection remain. All processing uses repository evidence and existing automation with no new external requests or paid dependencies.

# Public URL lifecycle

Published URLs are durable contracts. Keep existing Insight, project and tool slugs when changing titles or descriptions. Do not derive a new slug from a headline edit or silently drop a featured project detail page during a snapshot refresh.

## Ownership and review

- `data/url-lifecycle.json` records every concrete active HTML page and explicit 404 retirement decisions. It covers individual slugs that the existing route-pattern inventory intentionally normalizes away.
- `public/_redirects` is the sole owner of content moves and historical path aliases. Use exact canonical source paths and forced `301!` rules with final destinations.
- `netlify.toml` owns production-host redirects. The exact Netlify production alias points to the canonical domain; preview and branch hosts remain separate. Domain provisioning/www behavior is also verified by the existing deployment smoke test.
- Content authors and coding agents must update the register, content, sitemap/internal links and redirect or retirement decision in the same PR. A new page requires an explicit register entry. Review target relevance; a homepage redirect is not a substitute for a removed article.

CI checks the current static export and the prior revision's register/redirect sources. Deleting a register entry or old redirect does not erase a URL's history: it must remain active, redirect permanently, or have a documented 404 retirement. No new route or retirement is automatically invented to make CI green.

## Rename, move and removal

1. Prefer retaining the existing URL. If a move is necessary, export the successor at its final canonical URL.
2. Remove the old HTML source, add `old → final 301!` to `public/_redirects`, remove the old active register entry, and add the successor. Update all internal links and sitemap entries to the final URL.
3. When another old alias points at the moved page, update it directly to the new final destination. Chains, cycles, duplicate rules and active/exported redirect sources fail CI.
4. If there is no genuinely relevant successor, remove the page and active entry and add `{ "path": "/old-slug", "status": 404, "reason": "Why this content was removed without a successor" }` to `retired`. The static export's `404.html` supplies the missing-page response; no catch-all rewrite is needed. CI rejects a retired path that still has an exported file.
5. Do not reuse a retired URL for unrelated content. Preserve aliases while inbound links may exist; removal requires a reviewed retirement decision, not silent deletion.

### Status policy

| Status | Use |
|---|---|
| 301 | Permanent content moves for these GET/HEAD static pages; the supported Netlify content rule is `301!`. |
| 308 | A permanent move requiring method preservation. This site's static content does not need it; extend the parser/hosting tests only after verifying support and a concrete need. |
| 404 | Unknown routes and removed content without a relevant successor. This is the implemented retirement policy, with a genuine missing-page response and noindex. |
| 410 | An intentional permanent removal where an explicit Gone response is needed. It is not enabled here: verify hosting behavior and add HTTP tests before introducing it. A recorded 404 remains the safe default. |

Never use `/* /index.html 200` or redirect unrelated missing pages to `/`: both conceal missing content behind successful responses. Wildcards, conditional rules, temporary redirects, rewrites/proxies and query-specific content rules are intentionally unsupported by this audit. Introduce them only with dedicated matching/precedence tests; the checker fails closed instead of pretending to model Netlify's complete routing engine.

## Legacy audit: 2026-10-09

All nine deployed legacy rules returned a direct 301 with the configured Location. Each final destination returned 200 without another redirect at audit time. The eight GitHub destinations preserve historical links to their source projects; no equivalent old article body exists in the current Insights collection, so these established destinations are retained.

| Legacy source | Final destination |
|---|---|
| `/blog` | `/projects` |
| `/blog/fetch-php`, `/blog/fetch-php-2` | `https://github.com/Thavarshan/fetch-php` |
| `/blog/filterable` | `https://github.com/Thavarshan/filterable` |
| `/blog/phpvm` | `https://github.com/Thavarshan/phpvm` |
| `/blog/comet` | `https://github.com/Thavarshan/comet` |
| `/blog/matrix-php` | `https://github.com/Thavarshan/matrix` |
| `/blog/formlink` | `https://github.com/Thavarshan/formlink` |
| `/blog/secrets-loader` | `https://github.com/Thavarshan/secrets-loader` |

External target availability can change. Review external destination changes with a bounded request and redirects disabled. CI validates HTTPS URL syntax and configured graph topology; it does not depend on external GitHub uptime. Production smoke verifies each deployed source's response/Location and every explicit retirement. It does not fetch external destinations. Preview smoke executes trusted main and intentionally skips content-policy checks that might differ from the PR; the PR rendered audit validates its own exported rules.

## Checks and recovery

Run `npm run build`, `npm run seo:lifecycle`, and `npm run seo:audit`. To compare history locally, set `LIFECYCLE_BASE_REVISION=<full-base-SHA>` for `seo:lifecycle`; CI supplies the PR base or pre-push commit and fetches two history levels. The initial register has no earlier register, but existing legacy redirects are still protected. Missing/unfetchable base commits fail rather than skip the check.

The rendered audit additionally rejects internal anchors targeting known moved/retired URLs, validates permanent HTTP responses with redirects disabled, and verifies real 404 behavior. Its JSON report remains the existing `rendered-seo-audit` artifact. The local static server models only the owned exact forced rules, including query pass-through; production remains the authoritative check for Netlify behavior.

A failed gate blocks merge. Correct the page/register/rule together, or revert this scoped change to restore the prior export/configuration. Do not auto-delete or regenerate the URL register from the build to hide removals. There is no paid service, runtime database, additional publishing workflow or private data involved.

Netlify's official [redirect options](https://docs.netlify.com/manage/routing/redirects/redirect-options/) document forced rules, query pass-through and automatic `404.html` handling. [Redirect processing order](https://docs.netlify.com/manage/routing/redirects/overview/) documents `_redirects` versus TOML precedence.

# Search verification and measurement baseline

The owner is @Thavarshan. The production origin is `https://thavarshan.com`; submit `https://thavarshan.com/sitemap.xml`. Preview URLs and the Netlify alias are not webmaster properties for the portfolio. Search Console/Bing are free; no paid SEO tool or Google Analytics is required for this baseline.

## What the repository already provides

`src/app/robots.ts` is the sole robots source; the duplicate `public/_robots.txt` was removed in PR #68. `src/app/sitemap.ts` lists canonical public HTML pages. Existing static-export SEO checks cover metadata, discovery and page HTTP status; PDF documents and the IndexNow key carry noindex headers. Robots exclusions are crawler guidance, not protection for private data. Keep profile imports and application/mailbox data outside the public export.

`src/features/profile/verification.ts` reads `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` at **build time** and supplies root metadata. Values are optional, trimmed and restricted to ownership-code characters; paste only the `content` value, never a whole `<meta>` element. Invalid configuration fails the build without echoing the value. These ownership codes are necessarily visible in public HTML but should not be unnecessarily committed to Git, reports or logs. They are not API credentials and grant no access to search-performance reports by themselves.

## Owner setup

1. Open [Google Search Console](https://search.google.com/search-console). Add a **URL-prefix** property for `https://thavarshan.com/`. Choose HTML tag and obtain its `content` value. This method does not verify a Domain property; choose DNS TXT verification if you want the broader `thavarshan.com` Domain property instead.
2. In the existing Netlify site's environment-variable settings, add `GOOGLE_SITE_VERIFICATION` for the **production context**, including the build scope. Trigger a new production build; editing a variable alone cannot change an already exported site. Keep real values out of Deploy Previews and GitHub test jobs.
3. Run `npm run seo:webmaster`. A `present` Google tag confirms the code reached the initial HTML head. Return to Search Console and click **Verify**. Record confirmation privately; our public audit always says account ownership is unknown, since it has no authenticated console access. DNS-verified accounts can be valid with no meta tag.
4. In the verified property, submit `sitemap.xml` in Sitemaps. Confirm Google can fetch it. Use URL Inspection on the homepage and representative project, Insight and tool pages. Compare the Google-selected canonical with the declared canonical; inspect crawl/index status and last crawl. A successful live test means Google can access a page, not that the page is indexed. Request indexing for important changed pages when appropriate, rather than repeatedly submitting all URLs.
5. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/). Either import the verified Search Console property (owner-controlled Google authorization), or add the HTTPS site and choose meta-tag verification. Put only its ownership value in production build variable `BING_SITE_VERIFICATION`, rebuild, confirm the `msvalidate.01` tag, and complete verification in Bing. Submit the same canonical sitemap and use Bing's URL Inspection.

See official [Google ownership methods](https://support.google.com/webmasters/answer/9008080), [Google sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Bing verification](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b) and [Bing sitemaps](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed). Account access and ownership values are owner-controlled; no website code can create a verified account or retrieve private performance data without that authorization.

## Read-only production audit

Run `npm run seo:webmaster` after deployment, or inspect the existing **Deployment Smoke** job. Production runs execute the audit every six hours and after successful main CI. Preview runs retain their noindex checks and skip this production-only audit. It writes `test-results/webmaster/audit.json`, included in the smoke artifact (one-day retention), and prints a concise job summary. It does not send analytics events, request indexing or change content.

The audit uses initial HTTP responses, with scripts/subresources disabled, and existing SEO rules. It checks:

- A directly accessible robots file with exactly one canonical sitemap declaration.
- A well-formed sitemap urlset: canonical origin, no duplicate URLs/query strings/fragments, maximum 60 pages. Invalid sitemaps are refused before crawling pages.
- General, Googlebot and Bingbot rules, including wildcard patterns, longest-match Allow exceptions and exclusions for `/api/` and `/profile-imports/`.
- Every sitemap page returns 200 directly and satisfies canonical, HTML/HTTP indexing, metadata, heading, social and JSON-LD checks.
- Homepage verification tags are absent, present or invalid. Missing tags are informational because DNS/import verification may apply; malformed/duplicate tags fail.

Each request has a ten-second timeout, two-MiB response limit and no followed redirects. Only the exact production origin is requested. Reports contain timestamp, page counts, tag-presence states and safe failure identifiers; they never retain raw HTML or ownership codes. Request failure is reported rather than silently treating the site as healthy. Fix the named rule, redeploy and rerun. Revert the PR to remove the new audit; it has no storage migrations or generated public data.

**Limits:** a passing audit demonstrates technical eligibility, not indexing, account ownership, ranking or traffic. Our requests are not actual Googlebot/Bingbot visits; crawler-specific rules are evaluated from robots.txt. Private console data and field Core Web Vitals are unavailable to this audit. The local rendered audit complements this production check and catches changes before merge.

## Measurable operating routine

Once the property is verified, record the initial baseline privately using Search Console exports. Compare **last 28 days with previous 28 days**, keeping Web search, country/device filters and dates consistent. If history is missing, record the first available period and do not invent a before/after comparison.

| Question | Measure | Source |
| --- | --- | --- |
| Are we being discovered? | Impressions, query/page breakdown, indexed-page count and exclusions | Search Console Performance and Page indexing; Bing equivalents |
| Are people visiting from Google? | Clicks and CTR (`clicks / impressions`); zero impressions means undefined CTR | Search Console Performance |
| Which content needs attention? | Branded vs non-branded queries, page/query average position, changes in clicks and impressions | Search Console; deterministic prioritization belongs to #66 |
| Is the site usable and stable? | Lighthouse lab scores; field LCP/INP/CLS when enough real-user data exists | Existing CI; Search Console Core Web Vitals |
| Are visitors taking useful actions? | CV downloads, contact clicks, tool completions and source attribution | Existing `data/growth/latest.json` counters |

Treat average position as context, not the primary outcome. Changes in traffic can have multiple causes; a deployment date does not prove causation. Search Console clicks and website event counts use different measurement systems and cannot be treated as a single visitor funnel. The current cookie-free counters do not collect page views or unique visitors, so visitor conversion rates cannot be calculated. Contact clicks are not confirmed enquiries; downloads are not interviews.

After significant releases: check the production audit, inspect affected pages in both webmaster consoles, review sitemap status and indexing exclusions, and record the release date alongside the performance baseline. Weekly: compare page/query trends and relevant actions. Monthly: review access ownership, canonical selection, indexing exclusions and field performance. Issue #50 can consume the public audit's schema-versioned status/counts; private query exports must not be auto-committed by content refresh.

## Ownership and rotation

Keep one durable owner-controlled account with access to each property; review delegated access periodically. Store values in Netlify production build settings and account records privately. When rotating, add/verify the replacement method **before** removing the previous ownership method. Rebuild after changes and confirm live tag presence, then confirm ownership in each console. Keep valid verification tags/DNS records after verification so ownership can be rechecked. Never rotate or remove `BING_INDEXNOW_KEY` merely because a webmaster meta value changed: they serve different purposes.

IndexNow already runs after content refresh and submits the homepage/Insights URLs when configured. `BING_INDEXNOW_KEY` is separate from Bing ownership verification, and an accepted submission does not mean indexing. This issue does not expand submissions, add a new search API or automate account setup.

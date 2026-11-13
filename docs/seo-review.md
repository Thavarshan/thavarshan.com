# SEO and licensing review — 14 November 2026

## Findings and changes

- Added the MIT license and declared `MIT` in package.json and the root lockfile package. The README links to the license. Dependencies keep their own licenses.
- Production's 18 sitemap pages passed the raw-response webmaster audit: successful status, canonical metadata, indexing directives, headings, sharing metadata, structured data and crawler access. The local static-export audit also passed, including internal links and URL lifecycle checks.
- Confirmed a legacy redirect gap in production: `/blog/` and `/blog/fetch-php/` returned 404 while their slashless counterparts had permanent redirects. Added exact trailing-slash counterparts for every existing legacy redirect, pointing directly to the existing final destination. Unknown URLs still return 404; there is no catch-all homepage redirect.
- Extended the bounded production webmaster audit to probe missing root, project and Insight URLs for true 404 status and noindex. Sitemap-only checks previously could not catch an accidental successful fallback for unknown URLs. Added tests for successful, redirecting and failing-server fallback responses, plus request errors.

The Google notices describe 404/soft-404 exclusions but do not identify affected URLs. The Bing welcome message's HTML recommends sitemap submission and URL submission; its plain-text MIME alternative contains unrelated generic crawl-rate text. That is insufficient evidence to change crawl-rate settings. Existing sitemap discovery and optional IndexNow integration remain available.

## Remaining verification

1. Deploy these changes through the existing reviewed CI/deployment workflow, then confirm the legacy trailing-slash URLs return 301 directly to their configured destinations. Use the workflow run and production build-info revision to confirm the deployed commit.
2. In the authenticated Google Search Console Page indexing report, inspect the actual excluded URL examples and last-crawl dates. Restore missing intended pages, redirect moved pages only to relevant replacements, and retain true 404s where no replacement exists. Inspect live/rendered content for any current canonical page flagged as soft 404. Validate fixes once deployed. See [Google's crawl-error guidance](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors).
3. In Bing Webmaster Tools, confirm `https://thavarshan.com/sitemap.xml` was submitted successfully and inspect important changed URLs. Email welcome guidance does not prove a missing sitemap submission or a crawl-rate problem.
4. Treat `fetch-php.thavarshan.com` as a separate deployment: its notice includes 404, redirects and soft 404, but this portfolio repository does not own that documentation site's pages.

Authenticated console reports were not accessible through the available browser connection. No ownership, sitemap-submission, indexed-page or ranking claim follows from a passing public audit. Google/Bing HTML verification tags are absent in production; this is informational because DNS verification or an imported property can establish ownership without those tags. Keep existing verification methods intact.

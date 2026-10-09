# Webmaster baseline — issue #52

## Discovery

Main already has optional Google/Bing verification metadata, canonical sitemap/robots routes, IndexNow, a rendered static-export audit, and six-hourly production smoke checks. PR #68 removed `public/_robots.txt`; `src/app/robots.ts` is the sole robots source. Do not recreate these systems. No webmaster ownership tokens or authenticated search-performance data are available in this session.

## Implementation

1. Validate optional build-time verification values, with errors that never include the value. Test configured, absent and malformed input.
2. Reuse existing SEO rules and the collector's robots parser in a read-only production audit. Check the live robots/sitemap and every declared sitemap page, crawler-specific blocking, raw HTML metadata and verification-tag presence. Reject malformed/off-origin/over-budget sitemap input before fetching pages.
3. Add the audit to existing production smoke automation, with a machine-readable artifact and summary. Keep previews on their existing noindex smoke path. Account verification remains unknown unless the owner confirms it in the console; tag presence is not verification.
4. Document property setup, production build variables, sitemap submission, ownership/rotation, URL inspection and a 28-day measurement baseline. Link this routine from Growth Engine operations.

## Validation, cost and recovery

Test real HTTP behavior with injected responses, XML/HTML parsing, robots groups, invalid inputs and unavailable endpoints. Run typecheck, lint, formatting, unit tests and static build; verify fixture ownership tags in built HTML and run the production audit. Existing CI exercises browser/Lighthouse/CV checks. Node/Actions and existing Netlify stay within the current $0 baseline; only development TypeScript declarations for the already-installed jsdom parser added; no new runtime parser, paid services, API credentials, private search data or runtime storage added. Maximum 60 sitemap pages, 10-second requests and 2 MiB per response; redirects never followed and only the exact production origin fetched. Reports exclude ownership values/raw HTML. Failures do not mutate content. Revert this PR to roll back; retain valid ownership values until replacement verification succeeds.

## Account boundary

Owner must obtain Google/Bing property ownership values or verify via DNS/import. This PR can ship and validate the mechanism without falsely claiming the accounts are verified or pages indexed. Query-level search-performance processing is issue #66; the broad health report remains issue #50.

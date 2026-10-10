# Internal links and crawl depth

The homepage is the crawl entry point. Public content must be reachable through
rendered HTML anchors, with a shortest path of at most three clicks. The sitemap
is an inventory to check against, not a substitute for navigation.

| Source | Destination | Purpose |
| --- | --- | --- |
| Home and shared navigation/footer | Projects, Insights, tools, CV, privacy | Discover public sections and conversion paths |
| Projects index | Every published project | Browse engineering work |
| Insights index | Every published Insight | Browse technical writing |
| Tools index | Every published tool | Find practical developer utilities |
| Project detail | Relevant Insights, associated tools, CV/contact | Connect implementation evidence with guidance and next steps |
| Insight detail | Related Insights, contextual project links, associated tools, CV/contact | Connect explanations with practical examples |
| Tool detail | Curated projects/Insights, contact | Explain the engineering context of each utility |

Tool relationships are curated in `src/features/tools/registry.ts`. Project and
Insight pages derive their related-tool links from that same map, so both
directions stay consistent. Pages without a curated tool relationship omit the
section. Anchors use the destination's name rather than generic link text.

Hire and consulting are homepage sections (`/#hire` and `/#consulting`), not
separate indexable routes. Fragment links share the homepage's crawl depth.
Email and external profile links are conversion destinations, not internal pages.
Private job/application data and operational reports do not belong in this graph.

Run `npm run seo:audit` to build and inspect the static export with JavaScript
disabled. The existing bounded audit checks every sitemap page and internal link
response. Its `test-results/seo/audit.json` artifact now includes `linkGraph`:
each canonical path's shortest depth and unique incoming/outgoing page paths.
Unreachable pages (including disconnected cycles) and depths above three fail CI.
Only audited canonical pages participate in traversal; external URLs and assets
cannot make a content page appear reachable. Queries and fragments do not create
additional graph nodes. Existing redirect/lifecycle checks remain authoritative
for obsolete URLs; links should point directly to canonical routes.

When adding content, link it from its section index and add useful contextual
relationships. Check the audit artifact for reachability/depth and the browser
suite for mobile layout and accessibility. This measures technical discovery,
not Google's indexing or rankings, which require Search Console evidence.

# Off-site authority and canonical backlink map

Issue #65 · Owner: Jerome · Review cadence: monthly · Last research review: 2026-11-08

## Purpose

Help real readers and potential employers find the most relevant proof of work. This is an **editorial checklist**, not an automated backlink campaign or ranking guarantee. Do not buy links, submit duplicate posts to directories, impersonate anyone or bulk-post community replies.

The public portfolio is `https://thavarshan.com`. Deep links should point to the specific article, project or CV; there is no SEO advantage in forcing every profile to the homepage.

## Verified properties and recommended destinations

"Observed" means the external page was found publicly; it does **not** mean its outbound links or account ownership were inspected or changed. "Needs review" requires a human with access to inspect the property and update it where appropriate.

| Property (public evidence) | Useful canonical destination | Reason / action | Status |
| --- | --- | --- | --- |
| [GitHub @Thavarshan](https://github.com/Thavarshan) | `https://thavarshan.com` | Profile overview: portfolio, current technical specialties, contact and CV. Keep pinned project descriptions specific. | Observed; profile link needs review |
| [GitHub fetch-php](https://github.com/Thavarshan/fetch-php) | `https://thavarshan.com/projects/fetch-php` | Package README should link to the case study while preserving the project documentation URL as the primary developer destination. | Needs README verification |
| [GitHub filterable](https://github.com/Thavarshan/filterable) | `https://thavarshan.com/projects/filterable` | Explain Laravel filtering decisions and usage. | Needs README verification |
| [GitHub matrix](https://github.com/Thavarshan/matrix) | `https://thavarshan.com/projects/matrix` | Link the event-driven async PHP case study; related article: `/insights/event-driven-asynchronous-php-matrix-lessons`. | Needs README verification |
| [GitHub phpvm](https://github.com/Thavarshan/phpvm) | `https://thavarshan.com/projects/phpvm` | Link the version-manager case study without crowding installation instructions. | Needs README verification |
| [GitHub honeymelon](https://github.com/Thavarshan/honeymelon) | `https://thavarshan.com/projects/honeymelon` | Link the desktop media conversion case study. | Needs README verification |
| [GitHub dokimos](https://github.com/Thavarshan/dokimos) | `https://thavarshan.com/projects/dokimos` | Link the Python tooling case study. | Needs README verification |
| [Packagist user Thavarshan](https://packagist.org/users/Thavarshan/) | Per-package project pages, not a single generic profile URL | Maintain useful package descriptions/homepage metadata for `jerome/fetch-php`, `jerome/filterable`, `jerome/matrix`; never change canonical package download/installation URLs. | Public packages observed; metadata needs review |
| [DEV @thavarshan](https://dev.to/thavarshan) | `https://thavarshan.com/insights` for author bio; matching article URL for genuinely mirrored articles | Existing DEV posts on Matrix and phpvm are publicly indexed. Do not claim an unrelated site article is the canonical source; use `canonical_url` only when text is actually cross-posted from the original site. | Public articles observed; bio/canonicals need review |
| [LinkedIn profile](https://www.linkedin.com/in/thavarshan) | `https://thavarshan.com/cv` or homepage depending on the profile field | Recruiters need current experience, specialty and a clean CV. Confirm current public profile URL and edit rights before changing. | User-provided URL; external links not verified |
| Stack Overflow | None until verified | Locate the genuine owned account; never substitute a similarly named profile or create an account just for a backlink. | Unverified |

## Other legitimate ecosystem mentions

- Keep GitHub topics, repository descriptions, package registries and project documentation accurate. An existing package listing or community resource is more useful than a thin directory submission.
- Consider a substantive, helpful Laravel/PHP article on DEV or a relevant community when there is a genuinely new technique, example or project release. Link a case study only where it helps readers solve the discussed problem; respect each community's self-promotion rules.
- Do not ask for artificial reciprocal links. Do not use mass submissions, paid placements or automation that posts to third-party accounts without review.

## Canonical URLs versus tracking links

- Use **clean** `https://thavarshan.com/...` links in canonical tags, website/profile metadata, package homepages and README references. Never add tracking parameters to canonical URLs.
- For an explicitly shared campaign announcement (not canonical metadata), the existing `marketing/oss` templates may add `utm_source`, `utm_medium` and `utm_campaign`. Keep UTMs minimal, readable and optional; do not treat a campaign URL as the article's canonical identity.
- An externally hosted article's `rel=canonical` must represent the actual original article, not merely a related page on this website.

## Monthly drift checklist (manual)

1. Check whether each profile, package homepage and deep project URL still resolves and represents the correct person/project.
2. Inspect GitHub profile README and pinned repository README links, and update only links that are missing or outdated.
3. Inspect Packagist package metadata for the actively maintained packages; review DEV author bio and genuine article cross-post canonical settings.
4. Confirm LinkedIn CV destination and any Stack Overflow identity **from the owner's account**, without guessing credentials or identity.
5. Record changed URLs, who made the change, the date, and a public verification link. Keep credential-only screenshots or personal application data outside this public repository.
6. Recheck key Search Console referral pages if the owner has access; lack of ranking improvement is not proof that an external site should be spammed.

**Execution ledger:** 2026-11-08 — public properties and intended destinations mapped from public GitHub/Packagist/DEV pages and the repository's own profile data. No third-party account edits, backlink submissions, paid registrations, or live Search Console verification are claimed. The remaining external updates must be performed or authorized by the relevant account owner.

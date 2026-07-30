# Jerome Thayananthajothy Portfolio

A source-driven professional portfolio and CV system for [thavarshan.com](https://thavarshan.com). LinkedIn is authoritative for career and education data, GitHub is authoritative for open-source work, and both feed the same validated profile model used by the website and LaTeX CV.

The public experience is intentionally minimal and recruiter-focused. It includes an editorial homepage, an indexable HTML CV, substantive project pages, an Insights publication, GitHub and package-registry adoption metrics, structured data, dynamic social images, privacy-respecting analytics hooks, and a stable generated PDF résumé.

## Architecture

```text
LinkedIn data archive ──> validated ProfessionalProfile ──> website + LaTeX CV
                                                           │
GitHub REST API ────────> repository snapshot ─────────────┘
```

Source ownership is explicit:

- LinkedIn owns professional identity, summary, experience, education, certifications, skills, languages, and professional projects.
- GitHub owns public repositories, READMEs, topics, languages, stars, forks, URLs, and activity dates.
- Local policy controls privacy, repository exclusions, display counts, skill grouping, and SEO positioning. It must not silently override professional facts.
- Source conflicts are reported during synchronization. LinkedIn wins for career facts and GitHub wins for repository facts.

The raw LinkedIn ZIP is never committed. Only the sanitized generated profile snapshot is retained.

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS with CSS-based reduced-motion-aware transitions
- Zod for runtime profile validation
- `fflate` and `csv-parse` for safe LinkedIn archive ingestion
- GitHub REST API with six-hour Next.js revalidation
- LaTeX compiled with LuaLaTeX in a pinned TeX Live container
- Vitest, Testing Library, Playwright, and Lighthouse CI
- Netlify serving the static Next.js export from `out/`

## Public Routes

| Route | Purpose |
| --- | --- |
| `/` | Primary professional profile and recruiter narrative |
| `/cv` | Indexable HTML version of the professional CV |
| `/projects` | Automatically ranked featured open-source projects |
| `/projects/[repository]` | Source-driven project detail pages |
| `/insights` | Curated technical writing for AI, architecture, platforms, and developer tools |
| `/insights/[slug]` | Static canonical Insight articles with Article JSON-LD |
| `/feed.xml` | RSS feed for published Insights |
| `/privacy` | Cookie-free analytics and external-link privacy notes |
| `/docs/Jerome-Resume.pdf` | Stable generated CV PDF |
| `/sitemap.xml` | Sitemap containing all indexable profile and project routes |
| `/robots.txt` | Crawler rules and sitemap discovery |

The PDF is checked in at `public/docs/Jerome-Resume.pdf` and is refreshed from the generated LaTeX build during CV publishing. The `cv-latest` GitHub release is a secondary distribution copy of the same verified artifact.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The site works without environment variables. Static rendering uses the checked-in GitHub snapshot.

```bash
GITHUB_TOKEN=
GOOGLE_SITE_VERIFICATION=
BING_SITE_VERIFICATION=
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
BING_INDEXNOW_KEY=
```

- `GITHUB_TOKEN` is optional and server-only. A fine-grained token with public repository metadata access increases API limits for `npm run profile:github` and automation.
- `GOOGLE_SITE_VERIFICATION` adds the Google Search Console verification metadata.
- `BING_SITE_VERIFICATION` adds the Bing Webmaster Tools verification metadata.
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` sets the Plausible site domain. Set it to `thavarshan.com` in Netlify to enable analytics.
- `BING_INDEXNOW_KEY` enables `npm run seo:indexnow` to submit updated public URLs and builds `/indexnow-key.txt`.

Never prefix tokens with `NEXT_PUBLIC_`; public variables can be included in browser JavaScript.

The CV publishing workflow also accepts this GitHub Actions secret:

```bash
NETLIFY_BUILD_HOOK=
BING_INDEXNOW_KEY=
```

When configured, the scheduled content refresh workflow can trigger a fresh Netlify deployment and submit updated URLs to Bing IndexNow.

## Profile Data

The public model is defined and validated in `lib/profile-schema.ts`. The generated snapshots are:

```text
data/profile.generated.json   Sanitized LinkedIn-owned professional data
data/github.generated.json    Last-known public GitHub profile and projects
```

The initial snapshots reflect the currently verified profile. Future updates should be made through the import and synchronization commands rather than by editing website components.

### Download LinkedIn Data

From LinkedIn:

1. Open **Settings & Privacy**.
2. Open **Data privacy**.
3. Choose **Get a copy of your data**.
4. Request Profile, Positions, Education, Skills, Certifications, Projects, and Languages.
5. Download the resulting ZIP to a private local directory.

The importer recognizes those official CSV names even when they are nested in the archive. Missing sections are preserved from the previous valid snapshot; malformed sections abort the import.

### Import LinkedIn

```bash
npm run profile:import -- /absolute/path/to/linkedin-export.zip
```

The importer:

- checks archive and decompressed-file limits
- rejects unsafe archive paths
- parses known LinkedIn CSVs only
- normalizes supported LinkedIn date formats to `YYYY-MM`
- creates deterministic summaries and bullets
- preserves public email and link policy
- validates the complete result before atomically replacing the snapshot
- records an archive fingerprint without retaining the source archive

### Refresh GitHub

```bash
npm run profile:github
```

GitHub synchronization:

- paginates all owner repositories
- removes forks, archived repositories, disabled repositories, and policy exclusions
- ranks the remaining repositories by stars and update date
- selects the top five
- extracts bounded plain-text README context
- updates the fallback snapshot
- warns when GitHub identity fields conflict with LinkedIn career data

### Full Synchronization

Docker is required because the full command also compiles and verifies the LaTeX CV.

```bash
npm run profile:sync -- /absolute/path/to/linkedin-export.zip
```

This imports LinkedIn, refreshes GitHub, renders LaTeX, compiles the PDF, verifies its page count and text layer, and reports source conflicts.

### Publish a Profile Update

After reviewing the generated diff:

```bash
npm run profile:publish
```

This command requires authenticated `gh`. It refuses to proceed when unrelated working-tree changes exist, creates a timestamped branch, commits only generated profile artifacts, pushes the branch, and opens a pull request.

## LaTeX CV

The CV source is generated at:

```text
cv/generated/Jerome-Resume.tex
```

The compiler writes ignored build artifacts to:

```text
cv/output/Jerome-Resume.pdf
```

Render only the source:

```bash
npm run cv:render
```

Compile with the pinned TeX Live container:

```bash
npm run cv:build
```

Verify that the PDF is at most two pages, has extractable ATS-readable text, contains required sections, and does not expose the private mobile number:

```bash
npm run cv:verify
```

Build, verify, and copy the stable public PDF into `public/docs/Jerome-Resume.pdf`:

```bash
npm run cv:publish
```

The CV deliberately uses a one-column layout, standard text, semantic section headings, and normal hyperlinks. It contains no photograph, icon font, skill chart, phone number, or decorative table.

## GitHub Data

The website renders project pages, metrics, Open Graph images, and sitemap entries from `data/github.generated.json`. Runtime builds do not request GitHub; live public metadata is fetched only by `npm run profile:github` and the content-refresh workflow.

Only the five qualifying highest-starred repositories receive detail pages. This avoids thin automatically generated pages for every repository.

## Package Registry Evidence

Package-registry adoption is stored in:

```text
data/package-registry.generated.json
```

The current implementation includes Packagist snapshots for the public PHP packages under the `jerome/*` namespace. Project pages use this checked-in snapshot at build time, so registry outages do not break the website.

Refresh the snapshot:

```bash
npm run registry:sync
```

## Insights Publishing

Insights are authored as local `.mdx` files in:

```text
content/insights/
```

Each file must include validated frontmatter:

```ts
interface InsightDefinition {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  topics: string[];
  relatedProjects: string[];
  featured: boolean;
  draft: boolean;
  linkedinUrl?: string;
  devToUrl?: string;
}
```

The site statically generates `/insights`, every published `/insights/[slug]`, RSS, sitemap entries, canonical metadata, Open Graph images, Article JSON-LD, related Insights, and recruiter CTAs. Draft articles are excluded by default.

Generate reviewable distribution assets:

```bash
npm run insights:bundle
```

This writes ignored local files under `marketing/generated/` for each published Insight:

- LinkedIn post draft
- LinkedIn newsletter summary
- DEV canonical cross-post draft
- Two follow-up posts
- Metadata with tracked URLs and social-image URLs

Social publishing is intentionally review-based. Nothing auto-posts to LinkedIn, DEV, or any external channel.

## Analytics and Measurement

The layout includes the Plausible Cloud script with file-download, outbound-link, and tagged-event extensions. High-intent actions are tagged for these goals:

- `Contact`
- `Resume Download`
- `LinkedIn Visit`
- `GitHub Visit`
- `Repository Visit`
- `Newsletter Visit`
- `Insight 75% Read`

Article read-depth is tracked once per page view when a reader reaches roughly 75% scroll progress and Plausible is available. If analytics is blocked or unavailable, the site continues normally.

Submit new or materially updated URLs to Bing IndexNow:

```bash
npm run seo:indexnow
```

Without `BING_INDEXNOW_KEY`, the command prints the URLs that are ready for manual submission.

## External Profile Consistency

The website can publish canonical identity signals, but external services still need manual review. Use:

```text
marketing/external-profile-checklist.md
```

That checklist keeps LinkedIn, GitHub, DEV Community, Stack Overflow, Packagist, and the website aligned around the current Sino Lanka Group role, location, headline, website URL, and availability language.

## SEO

The SEO implementation includes:

- server-rendered, crawlable profile and project content
- a canonical Insights publication and RSS feed
- route-specific titles, descriptions, canonical URLs, and social metadata
- generated 1200×630 profile and project Open Graph images
- `ProfilePage`, `Person`, `WebSite`, `WebPage`, `CollectionPage`, `Article`, `SoftwareSourceCode`, and `BreadcrumbList` JSON-LD
- `sameAs`, `alumniOf`, `knowsAbout`, authorship, repository, and modification-date relationships
- expanded `sameAs` references for LinkedIn, GitHub, DEV Community, Stack Overflow, and Packagist
- sitemap modification dates sourced from profile imports, GitHub activity, and Insight publication dates
- crawler directives with large image and unrestricted snippet previews
- permanent legacy redirects
- Google Search Console and Bing verification hooks
- Plausible conversion goals for high-intent actions
- a canonical HTML CV and non-indexable PDF

After production deployment:

1. Set the Google and Bing verification values in Netlify.
2. Verify the domain in Google Search Console and Bing Webmaster Tools.
3. Submit `https://thavarshan.com/sitemap.xml`.
4. Inspect `/`, `/cv`, `/projects`, and one project URL.
5. Test deployed JSON-LD with Google Rich Results Test.
6. Configure Plausible Cloud for `thavarshan.com` and confirm custom goals.
7. Review LinkedIn creator analytics, Search Console, Bing Webmaster Tools, and Plausible monthly.

SEO improves discovery and machine understanding but does not guarantee rankings. Search performance should be evaluated through impressions, queries, click-through rates, indexed URLs, and Core Web Vitals over several weeks.

## Scripts

```bash
npm run dev              # development server
npm run build            # production Next.js build
npm run start            # preview the exported out/ directory
npm run typecheck        # TypeScript validation
npm run lint             # ESLint
npm run test             # unit and component tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # desktop and mobile Playwright checks
npm run audit            # dependency security audit
npm run profile:import   # import LinkedIn archive
npm run profile:github   # refresh GitHub snapshot
npm run profile:sync     # full source and CV synchronization
npm run profile:publish  # open generated-data pull request
npm run insights:bundle  # generate reviewed social distribution drafts
npm run registry:sync    # refresh package-registry adoption snapshot
npm run seo:indexnow     # submit or print updated URLs for Bing IndexNow
npm run cv:render        # generate LaTeX source
npm run cv:build         # compile the PDF in Docker
npm run cv:publish       # build, verify, and copy the public PDF
npm run cv:verify        # inspect PDF pages, text, and privacy
```

## Testing

Install the Playwright browser on a new machine:

```bash
npx playwright install chromium
```

Before shipping:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run cv:publish
npm run audit
```

Coverage includes archive variants and partial imports, invalid dates, source conflicts, repository selection, README normalization, LaTeX escaping, phone privacy, navigation, generated career content, project details, canonical metadata, JSON-LD, sitemap discovery, legacy redirects, CV download, active contact colors, reduced motion, and mobile overflow.

## Automation

`.github/workflows/ci.yml` runs type checking, linting, tests, audit, production build, Playwright, and Lighthouse checks.

`.github/workflows/content-refresh.yml` runs every Monday, manually, and after profile/CV-related changes land on `main`. It has two lanes:

- `refresh` runs on scheduled/manual events only. It updates public generated snapshots, builds and verifies the public CV PDF, validates the site, and opens or updates a reviewable pull request when generated files change.
- `publish-cv` runs on manual events and matching `main` pushes. It verifies the checked-in public PDF, publishes the stable `cv-latest` release asset, optionally triggers Netlify through `NETLIFY_BUILD_HOOK`, and optionally submits URLs through IndexNow.

Netlify configuration is stored in `netlify.toml`. The production project should use the `main` branch, run `npm run build`, and publish the generated `out/` directory.

## Privacy and Maintenance

- Never commit a LinkedIn ZIP, extracted account data, token, phone number, or private runtime configuration.
- Keep generated source facts in the normalized profile files; do not hard-code current employers in components.
- Update display/privacy policy in `data/profile-policy.ts`.
- Keep GitHub and LinkedIn tokens server-side.
- Review automated pull requests before merging professional profile changes.
- Do not add speculative achievements or AI-generated career claims.
- Do not restore Nuxt build artifacts such as `.nuxt/` or `.output/`; this project is now a Next.js static export.

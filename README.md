# Jerome Thayananthajothy Portfolio

A source-driven professional portfolio and CV system for [thavarshan.com](https://thavarshan.com). LinkedIn is authoritative for career and education data, GitHub is authoritative for open-source work, and both feed the same validated profile model used by the website and LaTeX CV.

The public experience is intentionally minimal and recruiter-focused. It includes an editorial homepage, an indexable HTML CV, substantive project pages, live GitHub adoption metrics, structured data, dynamic social images, and a stable generated PDF résumé.

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
- Tailwind CSS and Motion
- Zod for runtime profile validation
- `fflate` and `csv-parse` for safe LinkedIn archive ingestion
- GitHub REST API with six-hour Next.js revalidation
- LaTeX compiled with LuaLaTeX in a pinned TeX Live container
- Vitest, Testing Library, Playwright, and Lighthouse CI
- Netlify with its modern Next.js adapter

## Public Routes

| Route | Purpose |
| --- | --- |
| `/` | Primary professional profile and recruiter narrative |
| `/cv` | Indexable HTML version of the professional CV |
| `/projects` | Automatically ranked featured open-source projects |
| `/projects/[repository]` | Source-driven project detail pages |
| `/docs/Jerome-Resume.pdf` | Stable generated CV URL with local fallback |
| `/sitemap.xml` | Sitemap containing all indexable profile and project routes |
| `/robots.txt` | Crawler rules and sitemap discovery |

The PDF route looks for the `Jerome-Resume.pdf` asset on the `cv-latest` GitHub release. If it is not available, it redirects to the checked-in fallback PDF. PDF responses are marked `noindex` so `/cv` remains the canonical searchable version.

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

The site works without environment variables by using its checked-in GitHub snapshot.

```bash
GITHUB_TOKEN=
GITHUB_STATS_DISABLED=
GOOGLE_SITE_VERIFICATION=
BING_SITE_VERIFICATION=
```

- `GITHUB_TOKEN` is optional and server-only. A fine-grained token with public repository metadata access increases API limits.
- `GITHUB_STATS_DISABLED=1` forces the checked-in GitHub snapshot for deterministic builds and browser tests.
- `GOOGLE_SITE_VERIFICATION` adds the Google Search Console verification metadata.
- `BING_SITE_VERIFICATION` adds the Bing Webmaster Tools verification metadata.

Never prefix tokens with `NEXT_PUBLIC_`; public variables can be included in browser JavaScript.

The CV publishing workflow also accepts this GitHub Actions secret:

```bash
NETLIFY_BUILD_HOOK=
```

When configured, a successful weekly CV publication triggers a fresh Netlify deployment.

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

The CV deliberately uses a one-column layout, standard text, semantic section headings, and normal hyperlinks. It contains no photograph, icon font, skill chart, phone number, or decorative table.

## GitHub Data at Runtime

The website requests public GitHub metadata on the server and caches it for six hours. If GitHub is unavailable or rate-limited, the site uses `data/github.generated.json`, so pages, metrics, and CV content still render.

Only the five qualifying highest-starred repositories receive detail pages. This avoids thin automatically generated pages for every repository.

## SEO

The SEO implementation includes:

- server-rendered, crawlable profile and project content
- route-specific titles, descriptions, canonical URLs, and social metadata
- generated 1200×630 profile and project Open Graph images
- `ProfilePage`, `Person`, `WebSite`, `WebPage`, `CollectionPage`, `SoftwareSourceCode`, and `BreadcrumbList` JSON-LD
- `sameAs`, `alumniOf`, `knowsAbout`, authorship, repository, and modification-date relationships
- sitemap modification dates sourced from profile imports and GitHub activity
- crawler directives with large image and unrestricted snippet previews
- permanent legacy redirects
- Google Search Console and Bing verification hooks
- a canonical HTML CV and non-indexable PDF

After production deployment:

1. Set the Google and Bing verification values in Netlify.
2. Verify the domain in Google Search Console and Bing Webmaster Tools.
3. Submit `https://thavarshan.com/sitemap.xml`.
4. Inspect `/`, `/cv`, `/projects`, and one project URL.
5. Test deployed JSON-LD with Google Rich Results Test.
6. Enable Netlify Web Analytics for privacy-respecting traffic measurement.

SEO improves discovery and machine understanding but does not guarantee rankings. Search performance should be evaluated through impressions, queries, click-through rates, indexed URLs, and Core Web Vitals over several weeks.

## Scripts

```bash
npm run dev              # development server
npm run build            # production Next.js build
npm run start            # production server
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
npm run cv:render        # generate LaTeX source
npm run cv:build         # compile the PDF in Docker
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
GITHUB_STATS_DISABLED=1 npm run build
npm run test:e2e
npm run cv:build
npm run cv:verify
npm run audit
```

Coverage includes archive variants and partial imports, invalid dates, source conflicts, repository selection, README normalization, LaTeX escaping, phone privacy, navigation, generated career content, project details, canonical metadata, JSON-LD, sitemap discovery, legacy redirects, CV download, active contact colors, reduced motion, and mobile overflow.

## Automation

`.github/workflows/ci.yml` runs type checking, linting, tests, audit, production build, Playwright, and Lighthouse checks.

`.github/workflows/cv.yml` runs after profile-related changes, every Monday, or manually. It refreshes GitHub, compiles and verifies the CV, publishes the stable `cv-latest` release asset, and optionally triggers Netlify.

Netlify configuration is stored in `netlify.toml`. The production project should use the `main` branch and allow Netlify to apply its current Next.js adapter automatically.

## Privacy and Maintenance

- Never commit a LinkedIn ZIP, extracted account data, token, phone number, or private runtime configuration.
- Keep generated source facts in the normalized profile files; do not hard-code current employers in components.
- Update display/privacy policy in `data/profile-policy.ts`.
- Preserve the fallback PDF at `public/docs/Jerome-Resume-fallback.pdf`.
- Keep GitHub and LinkedIn tokens server-side.
- Review automated pull requests before merging professional profile changes.
- Do not add speculative achievements or AI-generated career claims.

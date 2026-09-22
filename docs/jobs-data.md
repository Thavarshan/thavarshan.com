# Laravel job opportunity dataset

`data/jobs.generated.json` is the reviewable handoff between this portfolio repository and the planned private Laravel application dashboard.

## Collection

Run:

```bash
npm run jobs:collect
```

The collector uses Playwright for two bounded, public-source operations:

1. Read LaraJobs' advertised RSS feed through Playwright's request context.
2. Open Laravel News and discover the LaraJobs links it currently features.

Records are canonicalized and deduplicated by job URL. Laravel News currently points to LaraJobs, so those links are merged rather than presented as independent jobs. The collector does not sign in, bypass access controls, complete application forms, or submit applications.

After collection, type checking, and focused tests succeed, the scheduled workflow commits only `data/jobs.generated.json` directly to `main`. The job and profile refresh workflows share a concurrency group so they cannot push generated changes simultaneously.

## Ranking and eligibility

Ranking is deterministic. It rewards Laravel, an appropriate seniority level, React/Vue/Inertia, cloud experience, and explicit remote or sponsorship language.

Eligibility is deliberately separate from match score:

- `eligible`: worldwide hiring or sponsorship is explicit.
- `ineligible`: a country restriction conflicts with working from Sri Lanka and sponsorship is not confirmed.
- `unknown`: the role looks relevant but the posting does not establish that a Sri Lankan applicant can be hired.

`unknown` must never be interpreted by the Laravel app as permission to apply automatically. Sponsorship and work authorization require job-specific evidence.

## Laravel consumer contract

The Laravel app should import the snapshot by immutable Git commit SHA, validate `schemaVersion`, and upsert by `opportunities[].id`. It should retain its own application state instead of writing it back into this public file.

The JSON contains only public job information and matching signals. CV variants, cover letters, contact details, screening answers, credentials, and application history belong in the private Laravel application.

## Operational notes

- Treat descriptions as untrusted text.
- Attribute and link back to the original source.
- Stop the workflow when the source format changes instead of silently emitting empty data.
- Review source terms and selectors periodically.
- Playwright is intentionally limited to discovery. Application automation will use separate, explicitly supported connectors or manual handoff.

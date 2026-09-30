# Private job review surface (Cloudflare Worker)

A server-rendered review page for the opportunities in `data/jobs.generated.json`, gated by Cloudflare Access. It is the first Cloudflare runtime in this repo, justified by a concrete need the static site cannot meet: **private, writable state** (shortlist/dismiss/notes) that must never reach the public repo or build (see #43, and the evaluation criteria in #44).

## Architecture

- `workers/job-review/` — the Worker (`index.ts` handlers, `access.ts` JWT verification, `render.ts` HTML, `wrangler.toml`).
- `lib/job-review.ts` — pure filter/sort/validation logic, unit-tested and free of Worker APIs.
- **Data:** fetched live from the public `main` copy of `jobs.generated.json` and validated with `opportunitySnapshotSchema`. A failure renders an error state (HTTP 502); data older than 48h shows a stale banner. No redeploy is needed when the daily refresh commits.
- **Review state:** one JSON blob (`reviews`) in Workers KV, keyed by opportunity id: `{status: new|reviewed|shortlisted|dismissed, note, updatedAt}`. Nothing is written to git, the Next.js build, or logs.
- **UI:** no client JavaScript. Filters are a GET form, review actions are POST forms, so it is keyboard accessible and works on any device. Default sort: eligible first, then fit score, then freshness. Filters: eligibility, min score, source, technology, remote scope, sponsorship, compensation, age, review state, closed. Each job shows its `scoreBreakdown`, reasons and concerns, and marks unknown fields explicitly. (The dataset has no confidence signal yet, so it is not part of the sort.)

## Security model

- **Fail closed:** every request must carry a valid `Cf-Access-Jwt-Assertion` (RS256, signature checked against the team's certs, `aud`, `iss`, expiry, and the allowed email). If `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` or `ALLOWED_EMAIL` are unset, everything returns 403. Access being removed or misconfigured therefore does not expose the page.
- `DEV_AUTH_BYPASS=1` (from a git-ignored `.dev.vars`) only works for `localhost`/`127.0.0.1` requests.
- POSTs require a same-origin `Origin` header; ids, statuses and notes are validated; all scraped text is HTML-escaped and links are limited to http(s).
- Responses are `noindex`, `no-store`, with a locked-down CSP (no scripts).
- The KV namespace id in `wrangler.toml` is an identifier, not a credential. Deploying uses your Wrangler login; no secrets are stored in the repo.

## Setup (one-time)

1. `npx wrangler login` (already done for the current account), then `npm run worker:deploy`. This creates `job-review.<account>.workers.dev`, which returns 403 until Access is configured.
2. Cloudflare dashboard → **Zero Trust** → **Access → Applications → Add → Self-hosted**: application domain = the Worker's hostname, policy **Allow** → *Emails* = your address. Alternatively enable **Cloudflare Access** on the Worker under *Settings → Domains & Routes*.
3. Copy the application's **AUD tag** and your team domain (`<team>.cloudflareaccess.com`), then set them as Worker variables (dashboard *Settings → Variables*, or uncomment in `wrangler.toml`): `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ALLOWED_EMAIL`.
4. Verify: an anonymous `curl -i https://<worker-host>/` must redirect to the Access login (or return 403), never job data.

## Automated deployment (GitHub Actions)

`.github/workflows/job-review-deploy.yml` deploys on pushes to `main` that touch the Worker or the shared scoring/review code (and via manual `workflow_dispatch`). It typechecks and runs the Worker tests first, and is a clean no-op until the secrets exist.

- Secrets: `CLOUDFLARE_API_TOKEN` (create at *My Profile → API Tokens → Custom token*, permissions **Account → Workers Scripts: Edit** and **Account → Workers KV Storage: Edit**, scoped to this account only) and `CLOUDFLARE_ACCOUNT_ID`. Set them with `gh secret set`, never by pasting into chat.
- Variables (non-secret): `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ALLOWED_EMAIL` via `gh variable set`. `--keep-vars` also preserves values set in the dashboard.
- The wrangler OAuth login used locally is short-lived and cannot be used in CI.

## Local development

`cp workers/job-review/.dev.vars.example workers/job-review/.dev.vars && npm run worker:dev` → http://localhost:8787. Local KV is simulated in `.wrangler/` (git-ignored).

## Cost and failure modes

Workers Free (100k requests/day) and KV Free (1k writes/day) are far above single-user needs; Access is free for up to 50 users. If GitHub raw is unreachable or the data fails validation the page shows an error; review state is unaffected. Rollback: `npx wrangler rollback`, or delete the Worker; the static site is untouched.

## Known limitations

- Review state is per-Worker KV, not exported; there is no history beyond `updatedAt`.
- The single-blob state assumes one reviewer.
- `confidence` (from the scoring model) is not yet in the dataset.

# ADR 0001 — A Cloudflare Worker for the private job review surface

- **Status:** Accepted (implemented in #70/#71, platform-hardened for #44)
- **Context issue:** #44 asked us to identify a concrete request-time/edge need *before* adding Cloudflare, and to close as not planned if none existed.

## Decision

Cloudflare Workers are used for exactly **one** capability: the private, writable job-review page (`workers/job-review/`). Everything else stays on GitHub Actions (batch/scheduled work) and Netlify static hosting (the public site).

## The concrete need

The job dataset is public, but reviewing it needs **private, writable state** (shortlist / dismiss / notes) that must never reach the public repo or the static build. A static site cannot hold per-user writable state, and GitHub Actions cannot serve an interactive request. This is the first and only request-time requirement in the repository.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| State in `localStorage` on a public `/jobs` page | Works, but is per-browser, unrecoverable, and puts a job-search page on the public portfolio. |
| Local-only tool | Only works on one machine. |
| A separate Laravel/Node backend | Paid or self-hosted infrastructure; explicitly out of scope. |
| Netlify Functions / Identity | Adds a second dynamic platform and its own limits and billing model. |

## Hard constraint: this must cost nothing

The owner cannot afford any infrastructure charge. Therefore:

- The Worker runs on the **Workers Free plan only**. On the Free plan, exceeding a limit makes requests **fail**; it never produces a charge. A charge requires someone to subscribe to a paid plan or enable a paid product.
- The configuration is restricted by an **allowlist** (`tests/unit/worker-cost-guard.test.ts`, run in CI): only plain variables and one KV namespace are permitted. R2, D1, Durable Objects, Queues, AI, Browser Rendering, Vectorize, Hyperdrive, custom limits/`usage_model`, placement, log push, observability, routes/zones and any other product fail the build until they are proven free and reviewed here.
- Access (Cloudflare Zero Trust) is free for up to 50 users; this project has one.
- See `docs/cost-policy.md` for every service in the project and the dashboard checks only the account owner can perform.

## Platform requirements (from #44) and how each is met

| Requirement | Implementation |
| --- | --- |
| Wrangler config, environment separation | `workers/job-review/wrangler.toml`. Production deploys from `main` (`job-review-deploy.yml`); pull requests get a **read-only preview version** of the same Worker (`job-review-preview.yml`) behind the same Access app. Previews share the production KV binding, so `READ_ONLY=1` makes the code refuse every write. |
| Health/version endpoint | `GET /healthz` → `{status, version, environment, kv, time}`; 503 when KV is unreadable. `version` is the short git SHA stamped at deploy. It sits behind Access like every route. |
| Explicit route ownership and CORS | Exactly three routes (`routes` in `index.ts`); everything else is 404/405. **No CORS by design**: preflight is refused, no `Access-Control-Allow-*` header is ever sent, and `Cross-Origin-Resource-Policy/Opener-Policy: same-origin` are set. |
| Authentication for non-public endpoints | Every route requires a valid Cloudflare Access JWT (signature, aud, iss, exp, allowed email); unset config fails closed. |
| Request validation, bounded execution | Form bodies: `application/x-www-form-urlencoded` only, 8 KiB hard cap (declared and streamed); ids/status/notes validated; upstream data fetch has an 8 s timeout and a 5 MiB cap. |
| Rate limiting / abuse controls | Best-effort per-isolate limits (120 reads/min, 30 writes/min per client) using no KV. Access is the real control; this only bounds accidents such as a runaway loop. |
| No secrets in bundles/logs/repo | Secrets come from GitHub/Cloudflare stores; logs use an allowlist-style redactor and never include notes, emails, tokens or query strings (tested). |
| Structured logs with request IDs | One JSON line per request with `requestId` (the `cf-ray` when present), method, path, status, duration and version; also returned as `X-Request-Id`. |
| Preview and production deploy path | Above. |
| Free-tier assumptions and graceful degradation | Below. |
| Local development | `docs/job-review-worker.md`. |

## Free-tier assumptions and graceful degradation

| Resource (Free plan) | Limit | Expected use (1 user) | What happens at the limit |
| --- | --- | --- | --- |
| Worker requests | 100,000/day | tens/day | Cloudflare returns errors until the daily reset; **no charge**. |
| Worker CPU | 10 ms/request | a few ms | Request errors; no charge. |
| KV reads | 100,000/day | tens/day | Page still renders with a "saved reviews unavailable" notice; saves refuse rather than overwrite. |
| KV writes | 1,000/day | a handful | Saves return 503 "nothing was saved"; nothing is lost or half-written. |
| KV storage | 1 GB | kilobytes | n/a |
| Access seats | 50 | 1 | n/a |

Design consequences: a failed KV **read** never leads to a write (this used to be able to overwrite all saved reviews with a single entry, fixed here); a failed KV **write** is reported honestly; and no code path spends KV writes on bookkeeping (rate limiting is in-memory).

## Consequences and triggers to revisit

- Any additional Worker capability needs its own justification here and must pass the cost guard.
- Revisit if a second request-time need appears (for example public analytics collection, #47) — that would need a *public* route, which changes the auth model and must be a separate decision.
- If the Free limits are ever approached, the answer is to reduce usage, not to upgrade the plan.

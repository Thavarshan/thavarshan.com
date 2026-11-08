# Private recruitment database (issue #99)

This is the storage foundation for the later Gmail sync and recruiter-action features (#100–#102). It **does not connect Gmail, send applications, or change the public website**.

## What is actually built

- `workers/recruitment/`: a second, standalone Cloudflare Worker, deliberately separate from `workers/job-review/` and the static Next.js portfolio.
- A private D1 database with versioned SQL migrations for opportunities, interactions, pipeline events, sync cursors, tasks, audit events, reviews and completed imports.
- Read-only import of the **public** `schemaVersion: 2` job snapshot in pages of 20. Each page is a D1 transaction, newer snapshots replace older public facts, and replays do not erase existing private records.
- A one-time migration of existing `JOBS_KV` reviews, including legacy aggregate values and individual overrides. Download a complete raw backup first, then explicitly supply its SHA-256 checksum before starting the import. Existing D1 edits are never overwritten.
- A versioned review-write endpoint using compare-and-swap (`expectedRevision`) so concurrent saves cannot silently overwrite one another. Every successful write has an audit record in the same transaction.
- Pagination, limited request bodies, same-origin write checks, defensive security headers, private logs, and a read-only preview option.

The database tables for tasks, sync cursors, interactions and pipeline events are **schema only** until their owning issues (#100–#102) implement the business workflows. Nothing is silently synchronized or submitted.

## Why this is a separate Worker

The existing review page still reads and writes its KV namespace. It stays working while this database is prepared, tested and imported; there is **no automatic cutover**. D1 provides SQL transactions and conditional updates that KV cannot offer for a growing recruitment workflow. The public site continues to be a static export and never receives mailbox contents, personal notes, authentication tokens or private database credentials.

The only shared storage binding is the old review KV namespace, exposed through a **read-only TypeScript interface** in this Worker. The new Worker never calls KV `put` or `delete`.

## Free-tier decision

D1 has a Workers Free allowance, but it is **not an unlimited store**. As of November 2026, the free tier includes daily row-read and row-write quotas and a 50-query-per-invocation limit. When a quota is exceeded, D1 rejects queries rather than charging a Workers Free account. See the [official D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/); verify them before setup.

The Worker uses one D1 binding, one existing KV binding, at most 20 public opportunities per transaction and 40 results per read. A read limiter (90 requests/minute) and write limiter (20 requests/minute) reduce accidental loops. All writes use parameterized SQL; multi-statement operations use D1 `batch`, which is atomic. A failed batch returns HTTP 503 without acknowledging a save. The existing Worker cost guard remains strict; only the new recruitment config is approved for D1.

This project does not enable a paid Workers plan, R2, Durable Objects, Queues, Cloudflare AI, or a public recruitment route. It does not introduce a scheduled importer: you trigger imports deliberately.

## Local setup (safe; no real recruitment data)

1. `npm ci`
2. `npm run recruitment:migrate:local`
3. `cp workers/recruitment/.dev.vars.example workers/recruitment/.dev.vars`
4. `npm run recruitment:dev` and visit `http://localhost:8787/healthz`.

The `DEV_AUTH_BYPASS=1` variable works **only** for `localhost` or `127.0.0.1`. It is not a substitute for Cloudflare Access. Do not deploy that variable. Local Wrangler stores test D1 and KV state under ignored `.wrangler/` directories, not in git. Production uses a different, explicitly provisioned D1 ID.

Run the focused checks:

```bash
npm run typecheck
npx vitest run tests/integration/workers/recruitment-storage.test.ts tests/integration/workers/worker-cost-guard.test.ts
npx wrangler deploy --dry-run --config workers/recruitment/wrangler.toml
```

These checks run with **synthetic fixture data**. The integration suite applies the real SQL migration in SQLite, verifies concurrent saves, tests transactional rollback when a quota failure is simulated, and restores a serialized database copy.

## One-time production setup — owner action required

The repository intentionally contains an all-zero **placeholder database ID**, not a real account binding. **Nothing will deploy automatically** when this code merges. Do not substitute an existing, unrelated D1 database.

1. Sign into the intended Cloudflare account. Verify it is on **Workers Free** and has capacity for another D1 database.
2. Create a new D1 database: `npx wrangler d1 create recruitment-private`. Copy the returned database UUID into `workers/recruitment/wrangler.toml` (review the change before deploying). This binding is an identifier, **not a credential**.
3. Apply the remote schema with `npm run recruitment:migrate:remote`. Keep the migration files in source control; never update a live schema by editing a previously applied migration.
4. Create a self-hosted Cloudflare Access application for the new Worker's `workers.dev` hostname, with an **Allow** rule limited to the owner's exact email. Record its audience tag (`ACCESS_AUD`) and the team's domain (`ACCESS_TEAM_DOMAIN`). The new app must protect the **recruitment** Worker, not only the existing job-review Worker.
5. Deploy manually with `npm run recruitment:deploy`. Before configuring Access secrets, all remote requests fail closed with 403.
6. Set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `ALLOWED_EMAIL` as Worker secrets with `npx wrangler secret put NAME --config workers/recruitment/wrangler.toml` (repeat for each name). Enter values at the interactive prompt; do not put tokens or email data into a public issue, command-line argument, or repository file.
7. Verify an unauthenticated request to `/healthz` is blocked (Access login or HTTP 403). Authenticate as the allowed owner, confirm `/healthz` reports `{ "status": "ok", "schema": 1 }`. Try a different account and verify refusal. A missing D1 binding or unapplied schema must return 503 after authentication.

CI deliberately has **no production D1 migrations, deploy, KV export, or real Gmail fixture**. Wrangler needs the owner's Cloudflare login and the new database ID before live setup can proceed.

## API and import order

All endpoints require a verified Cloudflare Access RS256 JWT for the **exact configured owner**. On POSTs, provide `Origin` equal to the Worker's origin and `Content-Type: application/json`. This is an owner-operated API, not a public application endpoint. No CORS headers are returned.

| Endpoint | Purpose |
| --- | --- |
| `GET /healthz` | Private migration readiness and version; no secrets |
| `GET /v1/snapshot` | Read public source version, generation time and record count |
| `POST /v1/snapshot/import` | Import one page of 20 public opportunities |
| `GET /v1/opportunities?after=&limit=40` | Read imported opportunities by ID; paginated |
| `GET /v1/reviews?after=&limit=40` | Read private review state and its revision |
| `POST /v1/reviews/{20-hex-id}` | Save a private review with optimistic concurrency |
| `GET /v1/legacy/export` | Download full raw KV review backup and its checksum; **private** |
| `POST /v1/legacy/import` | One-time, checked, idempotent KV-to-D1 import |

**Import current public opportunities:**

1. Call `GET /v1/snapshot` and record the returned `generatedAt`.
2. `POST /v1/snapshot/import` with `{"expectedGeneratedAt":"<generatedAt>","offset":0}`.
3. Repeat with the returned `nextOffset` until `complete` is true. If the public snapshot changes during import, the Worker responds 409. Restart with the new timestamp; an older page cannot replace a newer stored snapshot.
4. Replaying a page is safe; the same snapshot does not rewrite its existing opportunity rows.

**Import legacy reviews after a backup:**

1. Pause edits to the existing review page. Download `GET /v1/legacy/export` to a **private, encrypted local directory**. It includes original KV JSON, individual keys, normalized reviews and a stable SHA-256 checksum. **Never commit or attach it to CI.**
2. Download a second time and compare checksums to detect source changes during the export.
3. `POST /v1/legacy/import` with `{"checksum":"<checksum from backup>"}`. The Worker re-reads KV and refuses any mismatch (409), invalid record or incomplete listing (503).
4. The import marker, review records and audit entry commit atomically. A repeated import returns `imported:false`. A different backup cannot overwrite the completed import. Independently edited D1 records take precedence (`INSERT OR IGNORE`).
5. Verify `GET /v1/reviews`, compare counts and notes with the saved backup, then retain the original KV unchanged for rollback. Do not disable or replace the old review UI as part of this issue.

**Review save example:** `POST /v1/reviews/<id>` with `{"status":"shortlisted","note":"My private note","expectedRevision":0}` creates a record and returns revision `1`. A later edit sends revision `1` and receives revision `2`. Two simultaneous edits against revision `1` yield **one success and one 409**, never silent data loss. There is no automatic retry with stale data.

## Recovery and migration rollback

Before any remote schema change, export a private SQL backup:

```bash
npx wrangler d1 export recruitment-private --remote --config workers/recruitment/wrangler.toml --output /private/recruitment-backup.sql
```

Treat the file as sensitive: it can contain recruiter correspondence and notes once later features ship. Store it encrypted, outside the repo. For a **restore rehearsal**, create a *separate disposable local/remote database* and import the exported SQL there, using `npx wrangler d1 execute <new-database> --file /private/recruitment-backup.sql --local` (or `--remote` for the deliberately separate target). Never execute a full schema-and-data backup into a live database with existing records. Follow the [official D1 import/export guidance](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

The integration tests also serialize a populated local SQLite database and restore it into a fresh instance. When a D1 migration fails, Wrangler rolls back that individual migration. If an import or quota failure occurs, the Worker leaves the old KV data intact and refuses to acknowledge incomplete writes; investigate capacity or schema errors before retrying.

## Privacy and deployment rules

- Access removal or misconfiguration must never expose data; the Worker checks signatures, issuer, audience, expiry and exact owner independently of the Access gateway.
- Logs contain only request ID, method, sanitized route pattern, response status and duration. Do **not** record request bodies, emails, JWTs, personal notes, source job URLs or query strings.
- Never add a public site route, static JSON export, preview with write access, or Gmail data to GitHub Actions.
- This PR introduces no automated production deployment. A future deployment workflow must require an explicit Free-plan gate and the same authentication/security tests before any remote migration or deploy.

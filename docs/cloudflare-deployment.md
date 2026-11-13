# Cloudflare static hosting

The Next.js app remains a static export (`output: "export"`). Workers serves `out/` through `wrangler.json`. `wrangler.redirect.json` deploys a tiny separate Worker for `www.thavarshan.com`, preserving paths and query strings in a permanent redirect to `https://thavarshan.com`. Neither config introduces a paid product, storage binding or Node runtime. Existing private job-review and site-metrics Workers are independent.

## Deployment

```sh
npm ci
CONTEXT=production npm run build
npm run site:deploy:check
npm run site:dev
npm run site:deploy
```

Wrangler is already a locked development dependency. Production CI runs the mandatory quality/browser/SEO/CV/Lighthouse/security gate, builds with production values, deploys both configs, then checks the exact revision, security headers, redirects, missing pages and public PDF. Main pushes and manual main CI runs deploy; PR code never deploys production. The existing CI concurrency prevents overlapping main runs. `build-info.json` uses the GitHub commit and production context and is never cached or indexed.

The `Deploy to Cloudflare` job targets GitHub's existing `Production` environment with URL `https://thavarshan.com`. GitHub records the commit, workflow link and deployment status in the repository's **Deployments** history. Success includes the post-deployment smoke checks; a failed deployment or smoke check is recorded as failed. Only this job receives `deployments: write`; CI checks retain their existing permissions. These records track deployments performed by this workflow, not manual Wrangler deployments outside GitHub Actions.

PNG content types are explicit for root and nested extensionless Open Graph images, and deployment smoke verifies both. Security and document headers moved from `netlify.toml` into `public/_headers`. The metadata step appends marker/preview headers instead of overwriting that file. Legacy `_redirects` use Cloudflare's `301` syntax, including permanent slash-to-clean-path normalization; the lifecycle validator retains historical `301!` parsing for Git comparisons. No wildcard SPA fallback is used.

## Credentials and build values

Required GitHub Actions secrets already used by the other Workers:

- `CLOUDFLARE_ACCOUNT_ID`: the deployment account.
- `CLOUDFLARE_API_TOKEN`: Workers Scripts Edit, Workers Routes Edit and Zone Read scoped to the relevant account and `thavarshan.com` zone. Existing worker-only permissions may need expansion to manage custom domains.

Optional production build values:

| Setting | GitHub location | Effect when absent |
| --- | --- | --- |
| `GOOGLE_SITE_VERIFICATION` | Actions secret | No Search Console HTML ownership tag; existing DNS verification can still work. |
| `BING_SITE_VERIFICATION` | Actions secret | No Bing HTML ownership tag. |
| `BING_INDEXNOW_KEY` | Actions secret | No IndexNow submissions; the key endpoint is empty. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Actions variable | Plausible disabled. Leave unset unless already using that optional paid service. |

The site and first-party metrics work without these optional values. The Netlify project was deleted before migration, so old values could not be recovered. Obtain verification values from the respective ownership consoles if needed. Never generate replacements blindly or paste credentials into logs. Production-only settings are not supplied to PR preview builds.

`NETLIFY_BUILD_HOOK` is obsolete. Merged generated content now deploys through main CI; the CV publisher no longer calls Netlify. Historical planning documents may describe the earlier host.

## Previews

After the same mandatory CI gate as production, main pushes and manual main CI runs publish a stable preview at `https://thavarshan-site-preview.tjthavarshan.workers.dev`. GitHub's `Preview` environment links directly to that Worker and records its deployment status. This is a separate export of the tested main commit with `CONTEXT=deploy-preview`: it has noindex/nofollow headers, production canonical URLs, no custom-domain routes, and no production-only verification or analytics build values. The preview smoke check verifies its exact revision and these indexing boundaries. It is a public preview of main, not a private staging environment or a substitute for per-PR previews.

Successful same-repository PR CI publishes its already-tested static artifact under `thavarshan-site-pr-<number>.tjthavarshan.workers.dev`. The trusted main workflow validates the repository, marker and origin; it does not execute PR code with credentials. Previews are noindex, retain production canonical URLs and have no custom-domain routes. Closing a same-repository PR deletes only its numbered preview Worker.

Manual smoke checks accept `thavarshan-site-preview.tjthavarshan.workers.dev` or numbered PR hosts plus the full deployed revision. For a manual preview build use `CONTEXT=deploy-preview npm run build` and `npx wrangler deploy --config wrangler.json --env preview`.

## Domain cutover and rollback

Both apex and www must belong to the active Cloudflare DNS zone in the account. Remove conflicting old hosting records before attachment if Wrangler reports a conflict. Deploy and verify before deleting a previous host; the owner already deleted Netlify for this migration. Old `thavarshan.netlify.app` URLs are outside Cloudflare's control and are no longer production aliases.

`npx wrangler deployments list --config wrangler.json` shows deployed versions. Use `npx wrangler rollback --config wrangler.json` for the public site, and `--config wrangler.redirect.json` separately if its code changes. A rollback to Netlify would require recreating the deleted project, restoring settings and changing DNS.

References: [static assets](https://developers.cloudflare.com/workers/static-assets/), [headers](https://developers.cloudflare.com/workers/static-assets/headers/), [redirects](https://developers.cloudflare.com/workers/static-assets/redirects/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Dependency gate repairs

The pre-existing lockfile failed the mandatory security audit. The migration refreshes vulnerable locked packages within the declared dependency ranges rather than disabling the audit. Next.js moves from 16.4.0 to the patched 16.4.5 release; the static export and supported Node 22 build remain unchanged. A development-only `minimatch ^11.0.4` override resolves the remaining glob-amplification advisory in the lint toolchain. It requires Node 20 or newer (the project builds on 22), retains its ISC license, and is validated with lint, unit/browser tests and the complete CI gate.

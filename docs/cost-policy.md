# Cost policy: this project must cost $0

The owner cannot afford any infrastructure charge. Every service here is chosen and configured so that **exceeding a limit stops or slows something instead of billing**, and anything that could bill is opt-in and guarded.

## Services and how each is kept free

| Service | Used for | Why it cannot bill | Guard |
| --- | --- | --- | --- |
| **Cloudflare Workers + KV (Free plan)** | Private job-review page | Free plan limits are hard: over-limit requests fail. A charge requires subscribing to Workers Paid or enabling a paid product. | `tests/integration/workers/worker-cost-guard.test.ts` allowlists the Worker config; CI fails on any paid-capable setting. See ADR 0001. |
| **Cloudflare Workers + KV (Free plan), site-metrics** | First-party, cookie-free event collector (`docs/measurement.md`) | Same Free-plan limits as above; over-limit events are dropped, never billed. | The same CI allowlist covers `workers/site-metrics/wrangler.toml`. |
| **Cloudflare Access (Zero Trust Free)** | Login in front of the Worker | Free up to 50 users; this project has 1. | Documented; owner check below. |
| **Plausible Cloud (optional, PAID)** | Optional second analytics sink | **Paid.** Not required: measurement works without it. | Only active if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; leave it unset unless you choose to pay. |
| **GitHub Actions** | Scheduled collection, CI, deploys | The repository is **public**, and Actions minutes are free for public repositories. | Keep the repository public. If it were ever made private, minutes become metered. |
| **Netlify (static hosting)** | The public site | Netlify's free plan pauses a site when its free allowance is exhausted rather than billing. *(Stated from general knowledge of Netlify's free plan; confirm in your Netlify billing page.)* | Avoid unnecessary deploys: the collector no longer commits on unchanged days. |
| **Groq Free API** | AI application drafts | Free quotas reject requests; upgrading to Developer enables usage billing. | Fixed Groq endpoint/model, `GROQ_API_KEY` and `GROQ_FREE_PLAN_CONFIRMED=true`; bounded requests/tokens, no paid fallback. The assertion does not lock account billing: remain on Free. See [application setup](applications-data.md). |

## What only the account owner can verify (no tool here can see billing)

1. **Cloudflare → Manage Account → Billing → Subscriptions:** every product shows Free / $0. No Workers Paid, no Zero Trust paid plan. If a card is on file, that is fine as long as nothing paid is subscribed; you can also remove it.
2. **Cloudflare → Notifications:** add a *Billing* / usage alert so any future charge is flagged immediately.
3. **Cloudflare Zero Trust → Settings → Plans:** confirm the *Free* plan (up to 50 seats).
4. **Groq → Settings → Billing:** confirm **Free**; do not upgrade, add billing or buy credits. Disable applications if free terms change. [Groq billing FAQ](https://console.groq.com/docs/billing-faqs).
5. **Netlify → Team → Billing:** confirm the *Free* plan and that no paid add-ons are enabled.

## Rules for future changes

- Do not upgrade any plan or attach any paid add-on to make something work; reduce usage instead.
- Do not add a Cloudflare product to `wrangler.toml` without proving it is free on the Free plan and recording it in the ADR — CI will refuse otherwise.
- Any feature that calls a paid API must be off by default and require an explicit repository variable.

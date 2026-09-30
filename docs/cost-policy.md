# Cost policy: this project must cost $0

The owner cannot afford any infrastructure charge. Every service here is chosen and configured so that **exceeding a limit stops or slows something instead of billing**, and anything that could bill is opt-in and guarded.

## Services and how each is kept free

| Service | Used for | Why it cannot bill | Guard |
| --- | --- | --- | --- |
| **Cloudflare Workers + KV (Free plan)** | Private job-review page | Free plan limits are hard: over-limit requests fail. A charge requires subscribing to Workers Paid or enabling a paid product. | `tests/unit/worker-cost-guard.test.ts` allowlists the Worker config; CI fails on any paid-capable setting. See ADR 0001. |
| **Cloudflare Workers + KV (Free plan), site-metrics** | First-party, cookie-free event collector (`docs/measurement.md`) | Same Free-plan limits as above; over-limit events are dropped, never billed. | The same CI allowlist covers `workers/site-metrics/wrangler.toml`. |
| **Cloudflare Access (Zero Trust Free)** | Login in front of the Worker | Free up to 50 users; this project has 1. | Documented; owner check below. |
| **Plausible Cloud (optional, PAID)** | Optional second analytics sink | **Paid.** Not required: measurement works without it. | Only active if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; leave it unset unless you choose to pay. |
| **GitHub Actions** | Scheduled collection, CI, deploys | The repository is **public**, and Actions minutes are free for public repositories. | Keep the repository public. If it were ever made private, minutes become metered. |
| **Netlify (static hosting)** | The public site | Netlify's free plan pauses a site when its free allowance is exhausted rather than billing. *(Stated from general knowledge of Netlify's free plan; confirm in your Netlify billing page.)* | Avoid unnecessary deploys: the collector no longer commits on unchanged days. |
| **OpenAI API** | AI-drafted application packages (`applications:generate`) | **This one is pay-per-use and CAN bill.** | Opt-in only: it does nothing unless the repository variable `ENABLE_PAID_AI` is `true` (see `docs/applications-data.md`). Delete/limit the `OPENAI_API_KEY` in the OpenAI dashboard to make it impossible. |

## What only the account owner can verify (no tool here can see billing)

1. **Cloudflare → Manage Account → Billing → Subscriptions:** every product shows Free / $0. No Workers Paid, no Zero Trust paid plan. If a card is on file, that is fine as long as nothing paid is subscribed; you can also remove it.
2. **Cloudflare → Notifications:** add a *Billing* / usage alert so any future charge is flagged immediately.
3. **Cloudflare Zero Trust → Settings → Plans:** confirm the *Free* plan (up to 50 seats).
4. **OpenAI → Billing → Limits:** set the monthly budget to $0 (or revoke the key) unless you deliberately want AI drafting.
5. **Netlify → Team → Billing:** confirm the *Free* plan and that no paid add-ons are enabled.

## Rules for future changes

- Do not upgrade any plan or attach any paid add-on to make something work; reduce usage instead.
- Do not add a Cloudflare product to `wrangler.toml` without proving it is free on the Free plan and recording it in the ADR — CI will refuse otherwise.
- Any feature that calls a paid API must be off by default and require an explicit repository variable.

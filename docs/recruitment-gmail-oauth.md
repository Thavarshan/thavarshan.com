# Owner-only Gmail connection (issue #100, first phase)

The recruitment Worker now supports connecting **one Gmail account** using Google's OAuth consent flow. It requests only `gmail.readonly`; there is no send, compose, modify, or delete permission. The refresh token is encrypted before storage in private D1. The code does **not** yet scan messages, synchronize recruitment conversations, or send applications. The remaining synchronization work in #100, the action queue in #101, and outcome reporting in #102 were deferred as not planned during the 2026-11-14 backlog review. The closed issues retain the proposals and can be reopened if this private application becomes a priority; existing OAuth/storage code remains intact.

This is deliberately separate from the public portfolio and the existing KV review page. The private Worker must be deployed and protected by Cloudflare Access first; see [recruitment database setup](recruitment-storage.md).

## What you must do in Google Cloud

1. Sign into [Google Cloud Console](https://console.cloud.google.com/) with the Google account that owns the Gmail mailbox you want to connect. Select or create a dedicated project. Confirm any billing prompts **before** accepting them; this feature does not need a paid Google Cloud product.
2. Enable the **Gmail API** in **APIs & Services → Library**. Do not enable unrelated APIs or add paid products.
3. Configure **Google Auth Platform → Branding / Audience / Data Access**. Choose **External** if this is a personal consumer Gmail account. Add only the `https://www.googleapis.com/auth/gmail.readonly` permission. This is a **restricted** scope, so Google's verification rules apply to wider public use. For one owner's personal-use app, Google documents a limited personal-use verification exception; it is *not* blanket permission for a public multi-user app. Expect an unverified-app warning if applicable.
4. Avoid leaving an External OAuth app in **Testing** mode for a long-lived Gmail connection: Google documents a seven-day refresh-token expiration for non-basic scopes in that mode. For permitted personal use, configure the app as **In production** when you are ready, following Google's console instructions. This does **not** make the application verified.
5. Create a **Web application** OAuth client. Its **Authorized redirect URI** must be exactly:

   ```text
   https://YOUR-PRIVATE-RECRUITMENT-WORKER-DOMAIN/v1/gmail/callback
   ```

   Use the actual Worker hostname protected by your Cloudflare Access policy (no trailing slash, query, or alternate hostname). Keep the generated client ID and secret private. Do not publish the consent screen or OAuth client credentials in GitHub issues.

Google's official guidance: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth app verification FAQ](https://support.google.com/cloud/answer/13463073), [refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

## What you must do in Cloudflare

The first migration for this feature is `workers/recruitment/migrations/0002_gmail_oauth.sql`. It adds a ten-minute, one-time authorization-state table and a private credentials table. Apply migrations to the **dedicated recruitment D1 database** only after taking a private backup. The previous migration remains unchanged.

The private Worker must already have a functioning Access policy, a real `RECRUITMENT_DB` binding, and an **exact** `ALLOWED_EMAIL` matching your intended Gmail address. Do not deploy `DEV_AUTH_BYPASS` or a public Access policy.

Enter each value interactively as a Worker secret (repeat for all four):

```bash
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --config workers/recruitment/wrangler.toml
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --config workers/recruitment/wrangler.toml
npx wrangler secret put GOOGLE_OAUTH_REDIRECT_URI --config workers/recruitment/wrangler.toml
npx wrangler secret put GMAIL_TOKEN_KEY_B64 --config workers/recruitment/wrangler.toml
```

Generate a **new random 32-byte encryption key**, base64-encoded, on your trusted machine. One option with Node.js:

```bash
node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64")+"\n")'
```

Paste this key into the Wrangler secret prompt, not an issue, commit, shell argument, `.dev.vars` committed to git, or chat. Store a recovery copy securely: replacing or losing the key makes the previously encrypted OAuth token unreadable; a new authorization flow will then be necessary.

Once the D1 and Access setup from issue #99 is complete, the production sequence is:

1. Take a **private backup** of the existing D1 database per `recruitment-storage.md`.
2. Run `npm run recruitment:migrate:remote` and confirm migration `0002_gmail_oauth.sql` succeeds.
3. Deploy manually with `npm run recruitment:deploy` (there is no CI auto-deploy).
4. Open the private Worker using an Access session for the exact permitted account; `GET /v1/gmail/status` returns `not-connected` until consent succeeds.
5. Open `/v1/gmail/connect` in the same authenticated browser session and select **Continue to Google**. The page submits a same-origin form and redirects directly to Google; no DevTools console or copied authorization URL is needed.
6. Sign into the matching Gmail account and grant read-only permission. Google redirects to `/v1/gmail/callback`; the Worker exchanges the code, verifies the **actual Gmail profile email**, saves an AES-GCM encrypted refresh token, and redirects to `/v1/gmail/status`.
7. Confirm authenticated `GET /v1/gmail/status` returns `connected:true`. Check that unauthenticated traffic and another account cannot access the endpoint. No Gmail messages are downloaded at this stage.

Authorization attempts expire in ten minutes, and callback state is usable only once. Denial, an expired state, a mismatched mailbox, an unexpected scope, or a failed Google API call does **not** store a new refresh token. Start a fresh flow after any of these errors.

## Security and budget boundaries

- Only the owner authenticated through Cloudflare Access can use the OAuth routes. Cloudflare Access protection must cover the Google callback hostname, too; the owner should still have a valid Access browser session after Google's redirect.
- The private D1 store retains a **ciphertext refresh token** and metadata. Access tokens, OAuth client secrets, and raw PKCE verifiers are not stored in D1. Logs intentionally omit query parameters, mailbox addresses, authorization codes and bearer tokens.
- Google may display a consent-screen warning for unverified personal use. Do **not** bypass an organizational policy or expand access beyond your own mailbox under the personal-use exception.
- Do not configure a periodic cron, Gmail push webhook, paid Google Cloud service, or paid Workers plan. This phase performs **no background API calls**; the small number of Google API calls happen only when you explicitly complete authorization.
- If access is revoked, refresh-token expiration or `invalid_grant` handling must halt future synchronization and ask for reauthorization. That refresh/sync recovery logic is still to be implemented under issue #100; there is no Gmail sync scheduler yet.

For local-only verification using synthetic OAuth responses (no live Gmail or credentials):

```bash
npm run recruitment:migrate:local
npx vitest run tests/integration/workers/gmail-oauth.test.ts
npx wrangler deploy --dry-run --config workers/recruitment/wrangler.toml
```

The tests cover the owner/access gate, exact scope, S256 PKCE, encrypted storage, one-time state, expired/denied consent, wrong mailbox, Google failure, and a simulated atomic D1 rollback.

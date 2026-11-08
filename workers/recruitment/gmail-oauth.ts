import { z } from "zod";
import type { Database } from "./storage";

// No Gmail send, compose, modify, or full-mail scope is ever requested.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_PROFILE = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const MAX_OAUTH_BODY_BYTES = 16_384;
const STATE_TTL_MS = 10 * 60_000;
const encoder = new TextEncoder();

export interface GmailOAuthSettings {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GMAIL_TOKEN_KEY_B64?: string;
  ALLOWED_EMAIL?: string;
}

export class OAuthUnavailable extends Error {}
export class OAuthInvalidState extends Error {}
export class OAuthRejected extends Error {}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  owner: string;
  key: CryptoKey;
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  scope: z.string().min(1)
});
const profileResponse = z.object({
  emailAddress: z.email(),
  historyId: z.string().regex(/^\d+$/)
});

function base64(bytes: Uint8Array): string {
  // Both Cloudflare Workers and modern Node expose btoa/atob.
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomValue(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function encrypt(value: string, key: CryptoKey, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) }, key, encoder.encode(value)));
  return `v1:${base64(iv)}:${base64(ciphertext)}`;
}

async function decrypt(ciphertext: string, key: CryptoKey, context: string): Promise<string> {
  const parts = ciphertext.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new OAuthUnavailable("Invalid encrypted state");
  try {
    const iv = Uint8Array.from(atob(parts[1]), (char) => char.charCodeAt(0));
    const bytes = Uint8Array.from(atob(parts[2]), (char) => char.charCodeAt(0));
    if (iv.length !== 12) throw new Error("Invalid IV");
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) }, key, bytes)
    );
  } catch {
    throw new OAuthUnavailable("Encrypted state cannot be recovered");
  }
}

async function config(settings: GmailOAuthSettings, requestUrl: URL): Promise<OAuthConfig> {
  const {
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_REDIRECT_URI: configuredRedirect,
    GMAIL_TOKEN_KEY_B64
  } = settings;
  const owner = settings.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!clientId || !clientSecret || !configuredRedirect || !GMAIL_TOKEN_KEY_B64 || !owner || !z.email().safeParse(owner).success)
    throw new OAuthUnavailable("Gmail OAuth is not configured");

  let redirect: URL;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    redirect = new URL(configuredRedirect);
    const decoded = Uint8Array.from(atob(GMAIL_TOKEN_KEY_B64), (char) => char.charCodeAt(0));
    keyBytes = new Uint8Array(decoded.length);
    keyBytes.set(decoded);
  } catch {
    throw new OAuthUnavailable("Invalid Gmail OAuth configuration");
  }
  const local = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  if (
    redirect.origin !== requestUrl.origin ||
    redirect.pathname !== "/v1/gmail/callback" ||
    redirect.search ||
    redirect.hash ||
    (redirect.protocol !== "https:" && !(local && redirect.protocol === "http:")) ||
    keyBytes.length !== 32
  )
    throw new OAuthUnavailable("Gmail redirect or encryption key is invalid");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return { clientId, clientSecret, redirectUri: redirect.href, owner, key };
}

/** Ensure OAuth migration was applied before exposing any connection operation. */
export async function oauthReady(db: Database): Promise<boolean> {
  const result = await db
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('gmail_oauth_pending', 'gmail_oauth_credentials')")
    .first<{ n: number }>();
  return result?.n === 2;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new OAuthUnavailable("Google service is unavailable or rejected the connection");
  if (Number(response.headers.get("content-length")) > MAX_OAUTH_BODY_BYTES) throw new OAuthUnavailable("OAuth response too large");
  if (!response.body) throw new OAuthUnavailable("Empty OAuth response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_OAUTH_BODY_BYTES) throw new OAuthUnavailable("OAuth response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new OAuthUnavailable("Invalid Google response");
  }
}

export async function beginGmailAuthorization(db: Database, settings: GmailOAuthSettings, requestUrl: URL, now: Date) {
  const cfg = await config(settings, requestUrl);
  const state = randomValue();
  const verifier = randomValue();
  const stateHash = Array.from(await sha256(state), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const encryptedVerifier = await encrypt(verifier, cfg.key, `gmail-pkce:${stateHash}`);
  // Expired attempts contain only encrypted verifiers, and can be cleaned without disturbing active attempts.
  await db.prepare("DELETE FROM gmail_oauth_pending WHERE expires_at < ?").bind(now.toISOString()).run();
  await db
    .prepare("INSERT INTO gmail_oauth_pending (state_hash, verifier_ciphertext, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(stateHash, encryptedVerifier, new Date(now.getTime() + STATE_TTL_MS).toISOString(), now.toISOString())
    .run();
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", base64Url(await sha256(verifier)));
  url.searchParams.set("state", state);
  return { authorizationUrl: url.href, expiresInSeconds: STATE_TTL_MS / 1000 };
}

/** Single-use state consumption comes *before* any Google request; retries must start a new flow. */
export async function completeGmailAuthorization(db: Database, settings: GmailOAuthSettings, requestUrl: URL, now: Date, fetcher: typeof fetch) {
  const cfg = await config(settings, requestUrl);
  const state = requestUrl.searchParams.get("state") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new OAuthInvalidState("Invalid OAuth state");
  const stateHash = Array.from(await sha256(state), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const pending = await db
    .prepare("SELECT verifier_ciphertext, expires_at FROM gmail_oauth_pending WHERE state_hash = ? AND consumed_at IS NULL")
    .bind(stateHash)
    .first<{ verifier_ciphertext: string; expires_at: string }>();
  if (!pending || pending.expires_at <= now.toISOString()) throw new OAuthInvalidState("Expired or replayed OAuth state");
  const consumed = await db
    .prepare("UPDATE gmail_oauth_pending SET consumed_at = ? WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?")
    .bind(now.toISOString(), stateHash, now.toISOString())
    .run();
  if (consumed.meta?.changes !== 1) throw new OAuthInvalidState("OAuth state already used");

  if (requestUrl.searchParams.has("error")) throw new OAuthRejected("Google consent was not granted");
  const code = requestUrl.searchParams.get("code");
  if (!code || code.length > 2048 || Array.from(code).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
    throw new OAuthRejected("Missing authorization code");
  const verifier = await decrypt(pending.verifier_ciphertext, cfg.key, `gmail-pkce:${stateHash}`);

  const tokenResult = tokenResponse.safeParse(
    await boundedJson(
      await fetcher(GOOGLE_TOKEN, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: "authorization_code",
          code_verifier: verifier
        }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
      })
    )
  );
  if (!tokenResult.success) throw new OAuthUnavailable("Google returned an invalid authorization response");
  const token = tokenResult.data;
  if (token.scope !== GMAIL_SCOPE) throw new OAuthRejected("Unexpected Gmail permissions");

  const profileResult = profileResponse.safeParse(
    await boundedJson(
      await fetcher(GOOGLE_PROFILE, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token.access_token}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
      })
    )
  );
  if (!profileResult.success) throw new OAuthUnavailable("Google returned an invalid Gmail profile");
  const profile = profileResult.data;
  const email = profile.emailAddress.toLowerCase();
  if (email !== cfg.owner) throw new OAuthRejected("Gmail account does not match the authorized owner");

  const sealedToken = await encrypt(token.refresh_token, cfg.key, `gmail-refresh:${cfg.owner}`);
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO gmail_oauth_credentials (account_email, refresh_token_ciphertext, granted_scope, status, connected_at, updated_at)
         VALUES (?, ?, ?, 'connected', ?, ?)
         ON CONFLICT(account_email) DO UPDATE SET
           refresh_token_ciphertext = excluded.refresh_token_ciphertext,
           granted_scope = excluded.granted_scope,
           status = 'connected',
           connected_at = excluded.connected_at,
           updated_at = excluded.updated_at`
      )
      .bind(email, sealedToken, GMAIL_SCOPE, now.toISOString(), now.toISOString()),
    db
      .prepare(`INSERT OR IGNORE INTO sync_cursors (source, cursor_json, revision, updated_at) VALUES ('gmail', ?, 1, ?)`)
      .bind(JSON.stringify({ phase: "not-started", initialHistoryId: profile.historyId }), now.toISOString()),
    db.prepare("INSERT INTO audit_events (action, entity_type, entity_id, occurred_at) VALUES ('gmail.connected', 'oauth', 'owner', ?)").bind(now.toISOString())
  ]);
  if (results.length !== 3 || results.some((result) => !result.success)) throw new OAuthUnavailable("Connection was not saved");
  return { connected: true, scope: GMAIL_SCOPE, syncStatus: "not-started" };
}

export async function gmailConnectionStatus(db: Database, settings: GmailOAuthSettings) {
  const owner = settings.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!owner || !z.email().safeParse(owner).success) throw new OAuthUnavailable("Owner is not configured");
  const row = await db
    .prepare("SELECT status, connected_at FROM gmail_oauth_credentials WHERE account_email = ?")
    .bind(owner)
    .first<{ status: string; connected_at: string }>();
  return { connected: row?.status === "connected", status: row?.status ?? "not-connected", connectedAt: row?.connected_at ?? null };
}

-- Gmail OAuth credentials are private. The refresh token and PKCE verifier are always AES-GCM ciphertext.
-- The D1 database must never contain access tokens, client secrets or plaintext message content.
CREATE TABLE IF NOT EXISTS gmail_oauth_pending (
  state_hash TEXT PRIMARY KEY CHECK (length(state_hash) = 64),
  verifier_ciphertext TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gmail_oauth_pending_expiry_idx ON gmail_oauth_pending(expires_at);

CREATE TABLE IF NOT EXISTS gmail_oauth_credentials (
  account_email TEXT PRIMARY KEY,
  refresh_token_ciphertext TEXT NOT NULL,
  granted_scope TEXT NOT NULL CHECK (granted_scope = 'https://www.googleapis.com/auth/gmail.readonly'),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'reauthorization_required')),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

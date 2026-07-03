-- Migration 040: Create revoked_refresh_tokens table for refresh-token revocation
CREATE TABLE IF NOT EXISTS revoked_refresh_tokens (
  id SERIAL PRIMARY KEY,
  jti VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_refresh_tokens_jti ON revoked_refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_refresh_tokens_expires ON revoked_refresh_tokens(expires_at);

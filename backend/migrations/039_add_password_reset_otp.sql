-- Migration 039: Add password_reset_otps table for secure password reset flow
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps(expires_at);

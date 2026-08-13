-- Alter users table to support Custom Auth (Google / Phone OTP)
-- 1. Make password_hash, email, and mobile nullable
-- 2. Add google_id

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN mobile DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create table for storing OTPs
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    mobile VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_mobile ON otp_codes(mobile);

-- Link public orders to the authenticated user
ALTER TABLE public_orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

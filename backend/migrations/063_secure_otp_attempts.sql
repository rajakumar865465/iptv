-- 063_secure_otp_attempts.sql
-- Add failed attempt counters to OTP tables to prevent brute-force attacks (OWASP A07)
-- Uses safe anonymous DO block to avoid aborting if already applied or permissions differ

DO $$
BEGIN
    BEGIN
        ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_used ON password_reset_otps(email, used);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        CREATE INDEX IF NOT EXISTS idx_otp_codes_mobile_expires ON otp_codes(mobile, expires_at);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;


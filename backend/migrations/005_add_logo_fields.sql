-- Add logo status and local caching columns to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS logo_status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS logo_error TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS logo_checked_at TIMESTAMP;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS local_logo_url TEXT;

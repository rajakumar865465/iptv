-- Add missing columns to channels table for iptv-org import

-- Add new fields
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'iptv-org',
    ADD COLUMN IF NOT EXISTS source_channel_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS referrer TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS country VARCHAR(10),
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP DEFAULT NOW();

-- Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(source);
CREATE INDEX IF NOT EXISTS idx_channels_country ON channels(country);

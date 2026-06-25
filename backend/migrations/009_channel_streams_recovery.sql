-- 009_channel_streams_recovery.sql
-- Adds the new channel_streams table and modifies the channels table for stream recovery

CREATE TABLE IF NOT EXISTS channel_streams (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    stream_url TEXT NOT NULL,
    quality VARCHAR(20) DEFAULT 'auto', -- auto, hd, sd, low
    priority INTEGER DEFAULT 1, -- 1 is highest priority
    source_name VARCHAR(100),
    user_agent TEXT,
    referer TEXT,
    health_status VARCHAR(20) DEFAULT 'unknown', -- online, unstable, offline, unknown
    health_score INTEGER DEFAULT 100, -- 0 to 100
    fail_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_checked_at TIMESTAMP,
    last_success_at TIMESTAMP,
    last_failed_at TIMESTAMP,
    health_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, stream_url)
);

-- Index for fast lookup by channel
CREATE INDEX IF NOT EXISTS idx_channel_streams_channel_id ON channel_streams(channel_id);

-- Add new tracking columns to channels table
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS active_stream_id INTEGER REFERENCES channel_streams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(20) DEFAULT 'direct', -- direct, proxy
ADD COLUMN IF NOT EXISTS has_backup_streams BOOLEAN DEFAULT FALSE;

-- Trigger to update updated_at on channel_streams
CREATE OR REPLACE FUNCTION update_channel_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_channel_streams_updated_at ON channel_streams;
CREATE TRIGGER trg_channel_streams_updated_at
    BEFORE UPDATE ON channel_streams
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_streams_updated_at();

-- Backfill channel_streams using existing stream_url and backup_stream_url
INSERT INTO channel_streams (channel_id, stream_url, quality, priority, user_agent, referer)
SELECT id, stream_url, 'auto', 1, user_agent, referrer
FROM channels
WHERE stream_url IS NOT NULL AND stream_url != ''
ON CONFLICT (channel_id, stream_url) DO NOTHING;

INSERT INTO channel_streams (channel_id, stream_url, quality, priority, user_agent, referer)
SELECT id, backup_stream_url, 'auto', 2, user_agent, referrer
FROM channels
WHERE backup_stream_url IS NOT NULL AND backup_stream_url != ''
ON CONFLICT (channel_id, stream_url) DO NOTHING;

-- Set active_stream_id for existing channels
UPDATE channels c
SET 
    active_stream_id = (SELECT id FROM channel_streams cs WHERE cs.channel_id = c.id AND cs.priority = 1 LIMIT 1),
    has_backup_streams = CASE WHEN (SELECT count(*) FROM channel_streams cs WHERE cs.channel_id = c.id) > 1 THEN true ELSE false END;

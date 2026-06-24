-- Add health_status column to channels table for stream health tracking
ALTER TABLE channels ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

-- Create index for health status filtering
CREATE INDEX IF NOT EXISTS idx_channels_health ON channels(health_status);

-- 010_add_channel_fail_columns.sql
-- Fix #5: Move channel failure tracking columns from ALTER TABLE in request handler
-- to a proper migration. The reportFailure controller previously did ALTER TABLE
-- at runtime which is unsafe under concurrent requests.

ALTER TABLE channels
ADD COLUMN IF NOT EXISTS fail_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Index for querying frequently failing channels
CREATE INDEX IF NOT EXISTS idx_channels_fail_count ON channels(fail_count) WHERE fail_count > 0;

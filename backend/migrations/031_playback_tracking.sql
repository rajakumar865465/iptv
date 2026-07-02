-- Migration 031: Playback tracking improvements
-- Safe, idempotent — all changes use IF NOT EXISTS or DO-NOTHING patterns
-- Adds: stream_id on channel_reports + watch_history, quality/device tracking,
--       is_primary backfill, verification indexes.

-- 1. Add stream_id + playback detail columns to channel_reports
ALTER TABLE channel_reports
  ADD COLUMN IF NOT EXISTS stream_id        INTEGER REFERENCES channel_streams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS network_type     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS android_version  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS player_error     TEXT,
  ADD COLUMN IF NOT EXISTS has_played_once  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buffer_seconds   INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_channel_reports_stream
  ON channel_reports(stream_id) WHERE stream_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_reports_channel_date
  ON channel_reports(channel_id, created_at DESC);

-- 2. Add stream_id to watch_history so success can be tracked per stream
ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS stream_id INTEGER REFERENCES channel_streams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_watch_history_stream
  ON watch_history(stream_id) WHERE stream_id IS NOT NULL;

-- 3. Ensure needs_manual_verification index exists (column added in 028)
CREATE INDEX IF NOT EXISTS idx_channels_needs_verification
  ON channels(needs_manual_verification) WHERE needs_manual_verification = true;

-- 4. Ensure last_success_at column on channels (added in 011, but double-check)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP;

-- 5. Ensure success_count on channel_streams (added in 009/011)
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

-- 6. Backfill is_primary: the stream with the lowest priority per channel is primary
--    Only update rows that are not already correctly set
UPDATE channel_streams cs
SET is_primary = true
FROM (
  SELECT DISTINCT ON (channel_id) id
  FROM channel_streams
  WHERE is_hidden IS NOT TRUE
  ORDER BY channel_id, priority ASC, id ASC
) ranked
WHERE cs.id = ranked.id
  AND cs.is_primary IS NOT TRUE;

-- Set is_primary = false for all other streams per channel
UPDATE channel_streams
SET is_primary = false
WHERE is_primary IS NULL;

-- 7. Ensure health_score default on channels where it is NULL
UPDATE channels
SET health_score = 100
WHERE health_score IS NULL;

UPDATE channel_streams
SET health_score = 100
WHERE health_score IS NULL;

-- Migration 030: Backfill missing channel_streams rows and fix orphaned entries
-- Channels added/updated after migration 009 may have no channel_streams entry,
-- causing getChannelPlayback to return 404 "No streams available".

-- Step 1: Insert a channel_streams row for every channel that has no entry yet.
-- Uses 'referrer' from channels (double-r) mapped to 'referer' in channel_streams (single-r).
INSERT INTO channel_streams (channel_id, stream_url, quality, priority, user_agent, referer, health_status)
SELECT
  c.id,
  c.stream_url,
  'auto',
  1,
  c.user_agent,
  c.referrer,
  COALESCE(c.health_status, 'unknown')
FROM channels c
WHERE c.stream_url IS NOT NULL
  AND c.stream_url != ''
  AND NOT EXISTS (
    SELECT 1 FROM channel_streams cs WHERE cs.channel_id = c.id
  )
ON CONFLICT (channel_id, stream_url) DO NOTHING;

-- Step 2: For channels with a backup_stream_url and only one channel_stream entry,
-- add the backup as priority 2.
INSERT INTO channel_streams (channel_id, stream_url, quality, priority, user_agent, referer, health_status)
SELECT
  c.id,
  c.backup_stream_url,
  'auto',
  2,
  c.user_agent,
  c.referrer,
  'unknown'
FROM channels c
WHERE c.backup_stream_url IS NOT NULL
  AND c.backup_stream_url != ''
  AND NOT EXISTS (
    SELECT 1 FROM channel_streams cs
    WHERE cs.channel_id = c.id AND cs.stream_url = c.backup_stream_url
  )
ON CONFLICT (channel_id, stream_url) DO NOTHING;

-- Step 3: Reset any channels whose status was accidentally overwritten with health values
-- (bug in old stream_scanner.js that set channels.status = health_status).
-- Valid channel statuses are: active, inactive, pending_check.
-- Values like 'online', 'offline', 'unstable', 'unknown' are health values, not status values.
UPDATE channels
SET status = 'active'
WHERE status IN ('online', 'unstable', 'unknown')
  AND (health_status IS NOT NULL OR health_status IS NULL);

UPDATE channels
SET status = 'inactive'
WHERE status = 'offline';

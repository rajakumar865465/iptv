-- Migration 038: Recorder Fallback System
-- Adds per-recorder state tracking, fallback logging, and stale buffer support

-- Widen status fields for fallback states such as requires_licensed_source.
ALTER TABLE channels
  ALTER COLUMN buffer_status TYPE varchar(50);

-- Add recorder state columns to channels table
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS recorder_stream_url text,
  ADD COLUMN IF NOT EXISTS recorder_stream_id integer,
  ADD COLUMN IF NOT EXISTS recorder_fail_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recorder_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorder_last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorder_last_failure_reason text,
  ADD COLUMN IF NOT EXISTS recorder_session_segments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recorder_backup_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recorder_stale_buffer_until timestamptz,
  ADD COLUMN IF NOT EXISTS recorder_status_detail varchar(50),
  ADD COLUMN IF NOT EXISTS recorder_failed_stream_url text,
  ADD COLUMN IF NOT EXISTS recorder_backup_stream_url text;

-- Index for fast fallback stream selection
CREATE INDEX IF NOT EXISTS idx_channel_streams_fallback
  ON channel_streams(channel_id, is_hidden, health_status, last_success_at, fail_count, health_score DESC NULLS LAST);

-- Recorder fallback log table
CREATE TABLE IF NOT EXISTS recorder_fallback_log (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  from_stream_url text,
  from_stream_id integer,
  to_stream_url text,
  to_stream_id integer,
  result varchar(20), -- 'success', 'failed', 'all_failed'
  notes text,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recorder_fallback_log_channel
  ON recorder_fallback_log(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recorder_fallback_log_result
  ON recorder_fallback_log(result, created_at DESC);

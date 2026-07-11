-- Migration 049: Ensure all referenced columns exist
-- This migration acts as a safety net to add any columns that might have been
-- skipped or failed in previous migrations due to schema desync, causing
-- the "errorMissingColumn" crash in production.
-- All statements use ADD COLUMN IF NOT EXISTS and are idempotent.

-- Ensure all channels columns
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS buffer_depth_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_buffer_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS buffer_status varchar(50) DEFAULT 'offline',
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
  ADD COLUMN IF NOT EXISTS recorder_backup_stream_url text,
  ADD COLUMN IF NOT EXISTS aspect_ratio_type varchar(20) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS fit_note text,
  ADD COLUMN IF NOT EXISTS player_display_status varchar(50),
  ADD COLUMN IF NOT EXISTS popularity_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_status varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamp,
  ADD COLUMN IF NOT EXISTS last_success_at timestamp,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamp,
  ADD COLUMN IF NOT EXISTS fail_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 999,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS needs_manual_verification boolean DEFAULT false;

-- Ensure all channel_streams columns
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS health_status varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fail_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamp,
  ADD COLUMN IF NOT EXISTS last_success_at timestamp,
  ADD COLUMN IF NOT EXISTS last_failed_at timestamp,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamp, -- Used in some queries instead of last_failed_at
  ADD COLUMN IF NOT EXISTS last_success_timestamp timestamp,
  ADD COLUMN IF NOT EXISTS last_failure_timestamp timestamp,
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS restream_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_legal_source boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scanner_status varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS master_m3u8_load_success boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_playlist_load_success boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS playlist_refresh_success boolean DEFAULT false;

-- Migration 041: Smooth Playback Buffer Health & Gap Handling
-- Adds fields for skip-missing-chunks, buffer quality tracking, and admin metrics
-- Safe to re-run (idempotent)

-- Per-channel gap handling and buffer quality fields
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS gap_handling_mode varchar(30) DEFAULT 'skip_missing_chunks',
  ADD COLUMN IF NOT EXISTS allow_skip_missing_segments boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_missing_segments_allowed integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_clean_buffer_percentage integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS missing_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backup_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lower_quality_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_buffer_percentage decimal(5,2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS last_missing_segment_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_segment_at timestamptz,
  ADD COLUMN IF NOT EXISTS buffer_quality_status varchar(40) DEFAULT 'clean_buffer',
  ADD COLUMN IF NOT EXISTS active_recorder_stream_id integer,
  ADD COLUMN IF NOT EXISTS backup_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_source_error text,
  ADD COLUMN IF NOT EXISTS total_expected_segments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downloaded_segments integer DEFAULT 0;

-- Ensure gap_handling_mode only allows valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gap_handling_mode'
  ) THEN
    ALTER TABLE channels
      ADD CONSTRAINT chk_gap_handling_mode
      CHECK (gap_handling_mode IN ('skip_missing_chunks', 'black_filler', 'strict_stop'));
  END IF;
END $$;

-- Ensure buffer_quality_status only allows valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_buffer_quality_status'
  ) THEN
    ALTER TABLE channels
      ADD CONSTRAINT chk_buffer_quality_status
      CHECK (buffer_quality_status IN (
        'clean_buffer', 'minor_gaps', 'gap_repaired', 'skipping_missing_segments',
        'using_backup_segments', 'using_lower_quality_segments', 'too_many_missing_segments',
        'source_timeout', 'source_dead', 'backup_active', 'no_working_source',
        'buffer_ready', 'warming_up', 'low_buffer', 'requires_licensed_source',
        'needs_manual_verification'
      ));
  END IF;
END $$;

-- Add gap handling mode to channel_streams table
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS gap_handling_mode varchar(30) DEFAULT 'skip_missing_chunks',
  ADD COLUMN IF NOT EXISTS allow_skip_missing_segments boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS missing_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backup_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lower_quality_segment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_buffer_percentage decimal(5,2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS last_missing_segment_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_segment_at timestamptz,
  ADD COLUMN IF NOT EXISTS buffer_quality_status varchar(40) DEFAULT 'clean_buffer',
  ADD COLUMN IF NOT EXISTS last_source_error text;

-- Add segment-level tracking for delayed_buffer_segments
ALTER TABLE delayed_buffer_segments
  ADD COLUMN IF NOT EXISTS segment_status varchar(20) DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS source_type varchar(20) DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS recovery_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_method varchar(30),
  ADD COLUMN IF NOT EXISTS segment_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_segment_status'
  ) THEN
    ALTER TABLE delayed_buffer_segments
      ADD CONSTRAINT chk_segment_status
      CHECK (segment_status IN ('good', 'missing', 'skipped', 'recovered', 'backup', 'lower_quality'));
  END IF;
END $$;

-- Add segment source tracking table
CREATE TABLE IF NOT EXISTS delayed_buffer_segment_sources (
  id serial PRIMARY KEY,
  segment_id integer NOT NULL REFERENCES delayed_buffer_segments(id) ON DELETE CASCADE,
  source_stream_id integer REFERENCES channel_streams(id) ON DELETE SET NULL,
  source_type varchar(20) NOT NULL DEFAULT 'primary',
  recovery_method varchar(30),
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segment_sources_segment
  ON delayed_buffer_segment_sources(segment_id);

-- Buffer health history for admin trend charts
CREATE TABLE IF NOT EXISTS buffer_health_history (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  clean_buffer_percentage decimal(5,2),
  buffer_quality_status varchar(40),
  missing_segment_count integer DEFAULT 0,
  skipped_segment_count integer DEFAULT 0,
  recovered_segment_count integer DEFAULT 0,
  backup_segment_count integer DEFAULT 0,
  gap_handling_mode varchar(30),
  recorded_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buffer_health_channel_recorded
  ON buffer_health_history(channel_id, recorded_at DESC);

-- Comments
COMMENT ON COLUMN channels.gap_handling_mode IS 'How to handle missing segments: skip_missing_chunks, black_filler, strict_stop';
COMMENT ON COLUMN channels.clean_buffer_percentage IS 'Percentage of expected segments that were successfully downloaded (0-100)';
COMMENT ON COLUMN channels.buffer_quality_status IS 'Current buffer quality state: clean_buffer, minor_gaps, skipping_missing_segments, etc.';
COMMENT ON COLUMN delayed_buffer_segments.segment_status IS 'good, missing, skipped, recovered, backup, lower_quality';
COMMENT ON COLUMN delayed_buffer_segments.source_type IS 'primary, backup, lower_quality';

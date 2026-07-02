-- Migration 037: Smooth Playback / Delayed Live Buffer System
-- Ensures all required columns and tables exist (safe to re-run)

-- Per-channel smooth playback fields (idempotent additions)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS smooth_playback_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS playback_delay_seconds integer DEFAULT 300,
  ADD COLUMN IF NOT EXISTS buffer_status varchar(20) DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS buffer_depth_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restream_mode varchar(20) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS last_buffer_error text,
  ADD COLUMN IF NOT EXISTS is_buffer_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_buffer_segments integer DEFAULT 600,
  ADD COLUMN IF NOT EXISTS buffer_start_threshold integer DEFAULT 60;

-- Buffer recording sessions
CREATE TABLE IF NOT EXISTS delayed_buffer_sessions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  pid integer,
  started_at timestamptz DEFAULT NOW(),
  last_segment_at timestamptz,
  segment_count integer DEFAULT 0,
  status varchar(20) DEFAULT 'running',
  error_message text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Buffered HLS segment metadata
CREATE TABLE IF NOT EXISTS delayed_buffer_segments (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  segment_name varchar(255) NOT NULL,
  sequence_number integer NOT NULL,
  duration decimal(10,3) DEFAULT 0,
  file_size_bytes bigint DEFAULT 0,
  file_path varchar(500) NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(channel_id, sequence_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channels_smooth_playback
  ON channels(smooth_playback_enabled, buffer_status)
  WHERE smooth_playback_enabled = true;

CREATE INDEX IF NOT EXISTS idx_buffer_sessions_channel
  ON delayed_buffer_sessions(channel_id, status);

CREATE INDEX IF NOT EXISTS idx_buffer_sessions_last_segment
  ON delayed_buffer_sessions(last_segment_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_buffer_segments_channel_created
  ON delayed_buffer_segments(channel_id, created_at);

CREATE INDEX IF NOT EXISTS idx_buffer_segments_sequence
  ON delayed_buffer_segments(channel_id, sequence_number);

-- Migration 036: Store metadata for each buffered HLS segment
-- Actual .ts files are stored on disk; this table tracks them for cleanup and serving

CREATE TABLE IF NOT EXISTS delayed_buffer_segments (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  segment_name varchar(255) NOT NULL, -- e.g., "segment_00123.ts"
  sequence_number integer NOT NULL,
  duration decimal(10,3) DEFAULT 0, -- Segment duration in seconds
  file_size_bytes bigint DEFAULT 0,
  file_path varchar(500) NOT NULL, -- Relative path within buffer storage
  created_at timestamp with time zone DEFAULT NOW(),

  -- Ensure unique segment per channel+sequence
  UNIQUE(channel_id, sequence_number)
);

-- Index for fast cleanup of old segments
CREATE INDEX IF NOT EXISTS idx_buffer_segments_channel_created
ON delayed_buffer_segments(channel_id, created_at);

-- Index for serving segments in order
CREATE INDEX IF NOT EXISTS idx_buffer_segments_sequence
ON delayed_buffer_segments(channel_id, sequence_number);

-- 013_add_quality_fields.sql
-- Adds fields to channel_streams for professional resolution control

ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS quality_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
  ADD COLUMN IF NOT EXISTS bitrate INTEGER,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_stream_id INTEGER REFERENCES channel_streams(id) ON DELETE CASCADE;

-- Also add user preferences for quality
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_quality VARCHAR(50) DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS data_saver_enabled BOOLEAN DEFAULT false;

-- 017_stream_compatibility_fields.sql
-- Adds stream analysis, codec, redirect, header, playability, and proxy fields:

ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS final_url          TEXT,
  ADD COLUMN IF NOT EXISTS origin             TEXT,
  ADD COLUMN IF NOT EXISTS headers_json       JSONB,
  ADD COLUMN IF NOT EXISTS codec_video        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS codec_audio        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS container_type     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS segment_type       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS playback_mode      VARCHAR(20) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS vlc_playable       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS android_playable   BOOLEAN DEFAULT true;

-- Add index on playback_mode and android_playable for query/proxy path optimizations
CREATE INDEX IF NOT EXISTS idx_channel_streams_playback_mode ON channel_streams(playback_mode);
CREATE INDEX IF NOT EXISTS idx_channel_streams_playability   ON channel_streams(android_playable, vlc_playable);

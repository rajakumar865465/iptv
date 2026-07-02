-- Migration 034: Add smooth playback / delayed live fields to channels table
-- These fields control per-channel time-shift buffer behavior

-- Update existing channels: set restream_mode based on current stream_url presence
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

-- Add index for efficient querying by buffer status
CREATE INDEX IF NOT EXISTS idx_channels_smooth_playback
ON channels(smooth_playback_enabled, buffer_status)
WHERE smooth_playback_enabled = true;

-- Update comment for documentation
COMMENT ON COLUMN channels.smooth_playback_enabled IS 'Whether delayed live playback is active for this channel';
COMMENT ON COLUMN channels.playback_delay_seconds IS 'Delay in seconds (120-600). Default  Fascism  300 (5 min)';
COMMENT ON COLUMN channels.buffer_status IS 'Buffer health: ready, warming_up, low_buffer, source_slow, segment_missing, source_offline, stopped, error';
COMMENT ON COLUMN channels.buffer_depth_seconds IS 'Current buffered duration in seconds';
COMMENT ON COLUMN channels.restream_mode IS 'direct | delayed | disabled';
COMMENT ON COLUMN channels.is_buffer_ready IS 'True when buffer_depth >= playback_delay_seconds';

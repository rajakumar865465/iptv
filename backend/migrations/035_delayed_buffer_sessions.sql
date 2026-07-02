-- Migration 035: Track active buffer recording sessions per channel
-- Helps prevent duplicate recorders and monitor health

CREATE TABLE IF NOT EXISTS delayed_buffer_sessions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  pid integer, -- process ID if applicable
  started_at timestamp with time zone DEFAULT NOW(),
  last_segment_at timestamp with time zone,
  segment_count integer DEFAULT 0,
  status varchar(20) DEFAULT 'running', -- running, paused, stopped, error
  error_message text,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Index for quickly finding active sessions per channel
CREATE INDEX IF NOT EXISTS idx_buffer_sessions_channel
ON delayed_buffer_sessions(channel_id, status);

-- Index for finding stale sessions to restart
CREATE INDEX IF NOT EXISTS idx_buffer_sessions_last_segment
ON delayed_buffer_sessions(last_segment_at)
WHERE status = 'running';

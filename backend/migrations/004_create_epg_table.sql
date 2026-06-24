-- Create epg_programs table
CREATE TABLE IF NOT EXISTS epg_programs (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
  source_channel_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  category VARCHAR(100),
  language VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by channel and program time range
CREATE INDEX IF NOT EXISTS idx_epg_programs_channel_time 
ON epg_programs(channel_id, start_time, end_time);

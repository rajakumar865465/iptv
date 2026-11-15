-- Migration 066: Real-time Live Stream Sessions and High-Precision Watch Time Tracking

-- 1. Create stream_sessions table for tracking active and historical viewing sessions
CREATE TABLE IF NOT EXISTS stream_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    license_id INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(100),
    app_version VARCHAR(50),
    client_platform VARCHAR(50) DEFAULT 'android',
    device_model VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast lookup indexes for live monitoring and analytics
CREATE INDEX IF NOT EXISTS idx_stream_sessions_active ON stream_sessions(is_active, last_ping_at);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user ON stream_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_channel ON stream_sessions(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at ON stream_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_device_active ON stream_sessions(device_id, is_active);

-- 2. Add columns to devices table for rapid state lookups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'stream_started_at') THEN
        ALTER TABLE devices ADD COLUMN stream_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'current_session_id') THEN
        ALTER TABLE devices ADD COLUMN current_session_id INTEGER REFERENCES stream_sessions(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'ip_address') THEN
        ALTER TABLE devices ADD COLUMN ip_address VARCHAR(100);
    END IF;
END $$;

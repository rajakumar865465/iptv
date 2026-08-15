-- Migration: Add stream tracking columns to devices table

-- DO NOT wrap in a transaction (BEGIN/COMMIT) here as the migration runner handles it.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'last_stream_ping_at') THEN
        ALTER TABLE devices ADD COLUMN last_stream_ping_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'active_channel_id') THEN
        ALTER TABLE devices ADD COLUMN active_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL;
    END IF;
END $$;

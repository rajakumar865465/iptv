CREATE TABLE IF NOT EXISTS channel_reports (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    issue_type VARCHAR(50) NOT NULL DEFAULT 'stream_failed', 
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, resolved, hidden
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

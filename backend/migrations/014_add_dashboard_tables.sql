-- 014_add_dashboard_tables.sql
-- Adds tables for admin dashboard: audit logs, notifications, scan jobs, error logs

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs如故(\n    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
   我们的目标_type VARCHAR(50),
    target_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at DESC);

-- Notifications for in-app notices
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    target_type VARCHAR(20) DEFAULT 'all',
    target_ids INTEGER[],
    image_url VARCHAR(500),
    action_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_notif_active ON notifications(is_active, scheduled_at);

-- Stream scan jobs
CREATE TABLE IF NOT EXISTS stream_scan_jobs (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'pending',
    total_channels INTEGER DEFAULT 0,
    completed_channels INTEGER DEFAULT 0,
    failed_channels INTEGER DEFAULT 0,
    results JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_scan_status ON stream_scan_jobs(status);

-- API error logs
CREATE TABLE IF NOT EXISTS api_error_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10),
 ITVpath VARCHAR(255),
    status_code INTEGER,
    error_message TEXT,
    request_body JSONB,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_errors_created ON api_error_logs(created_at DESC);

-- Add admin_role to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20) DEFAULT 'admin';
CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(role, admin_role);
UPDATE users SET admin_role = 'super_admin' WHERE role = 'admin' AND admin_role IS NULL;

-- Migration 027: Channel Import & Management System Additions
-- Adds soft-deletes, import jobs, audit logs, and blocklists

-- 1. Extend Channels Table
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_visible_app BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_website BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_admin BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hidden_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_channels_canonical_name ON channels(canonical_name);
CREATE INDEX IF NOT EXISTS idx_channels_visibility ON channels(is_hidden, is_removed, is_visible_app);

-- 2. Extend Channel Streams Table
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS final_url TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS headers_json JSONB,
  ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
  ADD COLUMN IF NOT EXISTS bitrate INTEGER,
  ADD COLUMN IF NOT EXISTS source_stream_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- 3. Channel Blocklist Table
CREATE TABLE IF NOT EXISTS channel_blocklist (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  source_channel_id VARCHAR(255),
  tvg_id VARCHAR(255),
  canonical_name VARCHAR(255),
  stream_url_hash VARCHAR(255),
  reason TEXT,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocklist_source_id ON channel_blocklist(source, source_channel_id);
CREATE INDEX IF NOT EXISTS idx_blocklist_tvg_id ON channel_blocklist(tvg_id);

-- 4. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);

-- 5. Import Jobs Table
CREATE TABLE IF NOT EXISTS import_jobs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  source_url TEXT,
  options JSONB,
  total_parsed INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  errors_json JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger for import_jobs updated_at
CREATE OR REPLACE FUNCTION update_import_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_import_jobs_updated_at();

-- Trigger for blocklist updated_at
CREATE OR REPLACE FUNCTION update_blocklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blocklist_updated_at ON channel_blocklist;
CREATE TRIGGER trg_blocklist_updated_at
  BEFORE UPDATE ON channel_blocklist
  FOR EACH ROW EXECUTE FUNCTION update_blocklist_updated_at();

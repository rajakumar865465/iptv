-- Migration 054: Ensure app_releases table and seed default release if empty

CREATE TABLE IF NOT EXISTS app_releases (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  version_code INTEGER NOT NULL,
  apk_url TEXT NOT NULL,
  file_size VARCHAR(20),
  release_notes JSONB DEFAULT '[]',
  minimum_android_version VARCHAR(10) DEFAULT '7.0',
  is_latest BOOLEAN DEFAULT false,
  force_update BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_is_latest ON app_releases(is_latest);

-- Insert default release if table is empty
INSERT INTO app_releases (version, version_code, apk_url, file_size, release_notes, minimum_android_version, is_latest, force_update)
SELECT '1.2.1', 12, '/downloads/app-release.apk', '96.5 MB', '["Latest stable IPTV release", "Ultra-low latency streaming", "500+ Live Indian channels"]'::jsonb, '7.0', true, false
WHERE NOT EXISTS (SELECT 1 FROM app_releases LIMIT 1);

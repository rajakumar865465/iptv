-- Migration 055: Point latest app release to local direct server download
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_releases') THEN
    UPDATE app_releases 
    SET 
      version = '2.7',
      version_code = 27,
      apk_url = '/downloads/app-release.apk',
      file_size = '97.4 MB',
      release_notes = '["Latest v2.7 stable IPTV release", "Ultra-low latency streaming", "500+ Live Indian channels", "Direct high-speed download"]'::jsonb,
      is_latest = true
    WHERE id = (SELECT id FROM app_releases ORDER BY is_latest DESC, created_at DESC LIMIT 1);
  END IF;
END $$;

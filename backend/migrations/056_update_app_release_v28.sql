-- Migration 056: Update latest release record to v2.8.0 with 32.5 MB optimized size
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_releases') THEN
    UPDATE app_releases 
    SET 
      version = '2.8.0',
      version_code = 28,
      apk_url = '/downloads/app-release.apk',
      file_size = '32.5 MB',
      release_notes = '["v2.8.0 Major Performance Release", "Lightweight 32.5 MB high-speed APK", "64-bit ARM & 32-bit legacy hardware support", "Zero-stutter live hardware decoding cascade", "Instant token refresh & sub-second recovery"]'::jsonb,
      minimum_android_version = '5.0',
      is_latest = true
    WHERE id = (SELECT id FROM app_releases ORDER BY is_latest DESC, created_at DESC LIMIT 1);
  END IF;
END $$;

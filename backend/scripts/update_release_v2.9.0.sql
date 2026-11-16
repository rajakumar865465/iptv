-- 1. Insert or update app_releases for v2.9.0
UPDATE app_releases SET is_latest = false WHERE is_latest = true;

INSERT INTO app_releases (
    version,
    version_code,
    apk_url,
    file_size,
    release_notes,
    minimum_android_version,
    is_latest,
    force_update,
    created_at
) VALUES (
    '2.9.0',
    4040,
    '/downloads/app-release.apk',
    '33.3 MB',
    '["Fixed audio/video synchronization mismatch across all channels including Goldmines", "Hardware Direct Eco Engine: eliminated phone overheating and thermal throttling", "Silky smooth performance on low-end and budget devices", "Eliminated CPU-heavy deinterlacer overhead on SD/576i broadcast streams", "Hardware bilinear texture scaling for effortless 60fps rendering", "Restored natural system brightness to preserve battery life and keep device cool"]'::jsonb,
    '5.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.9.0'),
    ('latest_app_version', '2.9.0'),
    ('force_update', 'true'),
    ('apk_download_url', 'https://nivatv.luxomall.in/downloads/app-release.apk'),
    ('announcement_message', 'NivaTV v2.9.0 is live! Perfect audio/video sync, zero lag, cool phone playback, and smooth streaming on any phone.'),
    ('banner_message', 'NivaTV v2.9.0 Update Required — Enjoy perfectly synced audio/video and buttery smooth streaming that keeps your phone cool.')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- 3. Deactivate superseded notices and publish v2.9.0 notice
UPDATE notifications
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND (
    title ILIKE '%Update%Available%'
    OR title ~* 'v2\.[0-8]\.[0-9]'
  );

INSERT INTO notifications (
    title,
    body,
    target_type,
    is_active,
    action_url,
    created_at
) VALUES (
    '🚀 NivaTV v2.9.0 Major Performance Update!',
    'NivaTV v2.9.0 is now live! Perfectly synchronized audio & video, zero stutter, and cool-running smooth playback on all low-end & flagship phones. Tap to update now.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

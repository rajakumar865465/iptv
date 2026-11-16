-- 1. Insert or update app_releases for v2.8.9
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
    '2.8.9',
    4039,
    '/downloads/app-release.apk',
    '33.3 MB',
    '["Vivid Cinema Picture Engine with calibrated contrast, brightness, and rich saturation", "Automatic hardware screen backlight boost for crystal-clear viewing", "Removed accidental brightness, volume, and channel-switching swipe/double-tap gestures", "High-fidelity video surface texture rendering", "Universal & x86_64 emulator compatibility improvements"]'::jsonb,
    '5.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.9'),
    ('latest_app_version', '2.8.9'),
    ('force_update', 'true'),
    ('apk_download_url', 'https://nivatv.luxomall.in/downloads/app-release.apk'),
    ('announcement_message', 'NivaTV v2.8.9 is live! Vivid Cinema picture engine, brighter clear display, and simplified touch controls.'),
    ('banner_message', 'NivaTV v2.8.9 Update Required — Experience crystal-clear channels with Vivid Cinema picture mode and enhanced brightness.')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- 3. Deactivate superseded notices and publish v2.8.9 notice
UPDATE notifications
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND (
    title ILIKE '%Update%Available%'
    OR title ~* 'v2\.[0-8]\.[0-8]'
  );

INSERT INTO notifications (
    title,
    body,
    target_type,
    is_active,
    action_url,
    created_at
) VALUES (
    '🚀 NivaTV v2.8.9 Update Available!',
    'NivaTV v2.8.9 is live. Enhanced video clarity with Vivid Cinema picture engine, hardware screen brightness boost, and cleaner touch controls. Tap to update.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

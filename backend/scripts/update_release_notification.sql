-- 1. Insert or update app_releases for v2.8.2
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
    '2.8.2',
    31,
    '/downloads/app-release.apk',
    '33.2 MB',
    '["Incremented versionCode to 31 for seamless warning-free updates", "Full in-app Plans & Pricing portal integration", "Complete Master UI/UX redesign with light & dark theme", "Enhanced live stream buffering & playback stability"]'::jsonb,
    '7.0',
    true,
    false,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.0'),
    ('latest_app_version', '2.8.2'),
    ('force_update', 'false'),
    ('announcement_message', 'NivaTV v2.8.2 is now live! Please update your app for the best streaming experience.')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value;

-- 3. Insert notification for all users
INSERT INTO notifications (
    title,
    body,
    target_type,
    is_active,
    action_url,
    created_at
) VALUES (
    '🚀 New Update v2.8.2 Available!',
    'NivaTV v2.8.2 is live with smoother performance, updated plans, and key bug fixes. Tap below to download the latest version.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

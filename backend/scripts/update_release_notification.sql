-- 1. Insert or update app_releases for v2.8.5
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
    '2.8.5',
    34,
    '/downloads/app-release.apk',
    '33.2 MB',
    '["Fixed Working Only channels display: restored visibility of all 620+ active online channels", "Strict offline channel filtering: completely hides broken/offline streams", "Fast hardware-accelerated playback with instant channel loading"]'::jsonb,
    '7.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.5'),
    ('latest_app_version', '2.8.5'),
    ('force_update', 'true'),
    ('announcement_message', 'NivaTV v2.8.5 is live! Channels display and working filters fully fixed.')
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
    '🌟 All Channels Fixed Update v2.8.5 Available!',
    'NivaTV v2.8.5 is live: all 620+ active channels are now restored and working smoothly. Tap below to download the update.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

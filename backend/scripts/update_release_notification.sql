-- 1. Insert or update app_releases for v2.8.4
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
    '2.8.4',
    33,
    '/downloads/app-release.apk',
    '33.2 MB',
    '["Strict Working Only filtering: automatically hides all 250+ offline/dead channels so only 100% active, playable channels show in the app", "Restored ultra-fast zero-buffering hardware playback engine (auto-safe zero-copy direct surface rendering)", "Zero channel startup lag and butter-smooth audio/video playback"]'::jsonb,
    '7.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.4'),
    ('latest_app_version', '2.8.4'),
    ('force_update', 'true'),
    ('announcement_message', 'NivaTV v2.8.4 is now live! Fixed channel filtering to show only 100% active and working channels.')
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
    '🌟 All Channels Fixed Update v2.8.4 Available!',
    'NivaTV v2.8.4 is live: non-working channels are removed, and only working, fast-loading channels are displayed. Tap below to download the update.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

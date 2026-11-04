-- 1. Insert or update app_releases for v2.8.3
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
    '2.8.3',
    32,
    '/downloads/app-release.apk',
    '33.2 MB',
    '["Restored ultra-fast zero-buffering hardware playback engine (auto-safe zero-copy direct surface rendering)", "Fixed channel startup latency by eliminating blocking stream heartbeat delays", "Fixed continuous buffering caused by video-sync and readahead misconfigurations", "Butter-smooth audio/video playback on all Android devices"]'::jsonb,
    '7.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.3'),
    ('latest_app_version', '2.8.3'),
    ('force_update', 'true'),
    ('announcement_message', 'NivaTV v2.8.3 is now live! Please update your app for instant channel loading and zero buffering.')
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
    '⚡ Blazing Fast Playback Update v2.8.3 Available!',
    'NivaTV v2.8.3 is live with instant channel loading, zero buffering, and butter-smooth playback. Tap below to download the update.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

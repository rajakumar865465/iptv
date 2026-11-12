-- 1. Insert or update app_releases for v2.8.7
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
    '2.8.7',
    4037,
    '/downloads/app-release.apk',
    '33.2 MB',
    '["Fixed channel deduplication across Home, Live TV, and Search", "Fixed Search tab filter isolation with dedicated SearchCubit", "Full light and dark theme token support across all screens", "Improved rotation lifecycle, back-button navigation, and low-latency stream buffering"]'::jsonb,
    '5.0',
    true,
    true,
    NOW()
);

-- 2. Update app_settings (enforce v2.8.7 minimum & expose latest download URL + update notice)
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('minimum_app_version', '2.8.7'),
    ('latest_app_version', '2.8.7'),
    ('force_update', 'true'),
    ('apk_download_url', 'https://nivatv.luxomall.in/downloads/app-release.apk'),
    ('announcement_message', 'NivaTV v2.8.7 is live! Search isolation, channel deduplication, light/dark themes, and smoother playback.'),
    ('banner_message', 'NivaTV v2.8.7 Update Required — Update older apps for faster channels, isolated search, and Light & Dark themes.')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- 3. Deactivate superseded app update notices and publish the latest v2.8.7 notice
UPDATE notifications
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND (
    title ILIKE '%Update%Available%'
    OR title ~* 'v2\.[0-8]\.[0-7]'
  );

INSERT INTO notifications (
    title,
    body,
    target_type,
    is_active,
    action_url,
    created_at
) VALUES (
    '🚀 NivaTV v2.8.7 Update Available!',
    'NivaTV v2.8.7 is live (mandatory update for older versions). Includes instant deduplicated channels, isolated Search filters, Light & Dark themes, and low-latency streaming. Tap to download the latest APK.',
    'all',
    true,
    'https://nivatv.luxomall.in/downloads/app-release.apk',
    NOW()
);

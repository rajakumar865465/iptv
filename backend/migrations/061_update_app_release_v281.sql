-- 061_update_app_release_v281.sql

DO $$ 
BEGIN
    -- Insert or update the v2.8.1 release metadata
    IF NOT EXISTS (SELECT 1 FROM app_releases WHERE version = '2.8.1') THEN
        INSERT INTO app_releases (
            version, 
            version_code, 
            apk_url, 
            file_size, 
            release_notes, 
            minimum_android_version, 
            is_latest, 
            force_update
        ) VALUES (
            '2.8.1',
            30,
            '/downloads/app-release.apk',
            '34.6 MB',
            '["Fixed Google Sign-In on Android", "Performance optimizations and bug fixes"]'::jsonb,
            '5.0',
            true,
            true
        );
    ELSE
        UPDATE app_releases SET
            force_update = true,
            is_latest = true,
            release_notes = '["Fixed Google Sign-In on Android", "Performance optimizations and bug fixes"]'::jsonb,
            apk_url = '/downloads/app-release.apk',
            file_size = '34.6 MB',
            version_code = 30
        WHERE version = '2.8.1';
    END IF;
    
    -- Ensure older versions are no longer marked as latest
    UPDATE app_releases SET is_latest = false WHERE version != '2.8.1';
END $$;

-- 061_update_app_release_v281.sql

DO $$ 
BEGIN
    -- Insert or update the v2.8.1 release metadata
    IF NOT EXISTS (SELECT 1 FROM app_releases WHERE version = '2.8.1') THEN
        INSERT INTO app_releases (
            version, 
            version_code, 
            release_date, 
            force_update, 
            changelog, 
            download_url, 
            file_size, 
            min_os_version
        ) VALUES (
            '2.8.1',
            30,
            CURRENT_TIMESTAMP,
            true, -- Force update to ensure users get the Google Auth fix
            '• Fixed Google Sign-In on Android\n• Performance optimizations and bug fixes',
            '/downloads/app-release.apk',
            '34.6 MB',
            '5.0'
        );
    ELSE
        UPDATE app_releases SET
            force_update = true,
            changelog = '• Fixed Google Sign-In on Android\n• Performance optimizations and bug fixes',
            download_url = '/downloads/app-release.apk',
            file_size = '34.6 MB',
            release_date = CURRENT_TIMESTAMP,
            version_code = 30
        WHERE version = '2.8.1';
    END IF;
END $$;

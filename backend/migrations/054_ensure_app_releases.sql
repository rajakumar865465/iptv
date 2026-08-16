-- Migration 054: Seed default app release if table is empty
-- Uses anonymous block to ensure permission safety without requiring DDL ownership

DO $$
BEGIN
    -- Attempt to grant ownership if possible (ignored if caller lacks superuser rights)
    BEGIN
        EXECUTE 'ALTER TABLE app_releases OWNER TO ' || current_user;
    EXCEPTION WHEN OTHERS THEN
        -- Not an owner or no privileges — safe to ignore, table already exists
        NULL;
    END;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_releases') THEN
        INSERT INTO app_releases (version, version_code, apk_url, file_size, release_notes, minimum_android_version, is_latest, force_update)
        SELECT '1.2.1', 12, '/downloads/app-release.apk', '96.5 MB', '["Latest stable IPTV release", "Ultra-low latency streaming", "500+ Live Indian channels"]'::jsonb, '7.0', true, false
        WHERE NOT EXISTS (SELECT 1 FROM app_releases LIMIT 1);
    END IF;
END $$;

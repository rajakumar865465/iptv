-- 015_performance_and_constraints.sql
-- DB-05: Add index on watch_history.watched_at for analytics performance
-- DB-09: Add unique constraint on devices(user_id, device_id) to prevent duplicate device rows
--        on concurrent login requests (e.g. double-tap)

-- DB-05: watch_history analytics query filters by watched_at > NOW() - INTERVAL '30 days'
-- Without this index it does a full table scan as history grows.
CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at DESC);

-- DB-09: Prevent race-condition duplicate device rows.
-- The application already does a SELECT-before-INSERT but that is not atomic.
-- This constraint provides a database-level guarantee.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_devices_user_device' 
          AND table_name = 'devices'
    ) THEN
        ALTER TABLE devices ADD CONSTRAINT uq_devices_user_device UNIQUE (user_id, device_id);
    END IF;
END $$;

-- Migration 048: Re-number note for 045_add_unique_constraint_sessions.sql
-- The unique constraint on delayed_buffer_sessions(channel_id) was originally
-- shipped as 045_add_unique_constraint_sessions.sql, which conflicts with
-- 045_add_consecutive_scan_failures.sql (both use prefix 045).
-- The original file is left intact so existing environments that already
-- have it in schema_migrations are unaffected. This migration is a safe
-- no-op on all environments: the constraint is applied with IF NOT EXISTS
-- semantics via DO-block so it never raises an error if it already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'delayed_buffer_sessions_channel_id_key'
      AND conrelid = 'delayed_buffer_sessions'::regclass
  ) THEN
    ALTER TABLE delayed_buffer_sessions
      ADD CONSTRAINT delayed_buffer_sessions_channel_id_key UNIQUE (channel_id);
  END IF;
END
$$;

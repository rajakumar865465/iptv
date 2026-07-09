-- Migration 045: Add unique constraint to delayed_buffer_sessions on channel_id
-- This fixes the 'infer_arbiter_indexes' PostgreSQL error caused by ON CONFLICT (channel_id)

ALTER TABLE delayed_buffer_sessions ADD CONSTRAINT delayed_buffer_sessions_channel_id_key UNIQUE (channel_id);

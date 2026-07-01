-- Migration 028: Add Admin Note and Manual Verification fields

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS needs_manual_verification BOOLEAN DEFAULT false;

-- Add a column to blocklist to support blocklist by canonical name or tvg_id without a source_channel_id
-- (Wait, these columns already exist in 027_channel_management_system.sql: source, source_channel_id, tvg_id, canonical_name, stream_url_hash, reason, admin_id)
-- Just adding admin_note for blocklist as well to be safe
ALTER TABLE channel_blocklist
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

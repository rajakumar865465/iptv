-- Migration 050: Fix admin_audit_logs missing columns
-- Migration 027 tried to redefine admin_audit_logs using CREATE TABLE IF NOT EXISTS,
-- but the table was already created in 014, so the new columns were never added.
-- This migration explicitly adds the missing columns to the existing table.

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- In 014, target_id was VARCHAR(50). In 027 it was redefined as INTEGER.
-- The backend casts or passes integers, but it's safe to keep it as VARCHAR(50) 
-- if it exists, or alter it. We will leave the type as is to avoid breaking changes, 
-- but add the missing old_value/new_value/reason columns that are crashing auditLogger.js.

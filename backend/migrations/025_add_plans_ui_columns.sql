-- Migration 025: Add UI/display columns to plans table
-- These columns are required by the public pricing page and admin plan management.
-- All use IF NOT EXISTS so this is safe to run multiple times.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug          TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS regular_price DECIMAL(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS offer_label   VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_popular    BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_best_value BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order    INTEGER DEFAULT 0;

-- Backfill slugs for existing plans
UPDATE plans SET slug = 'trial-1-day'   WHERE slug IS NULL AND (name ILIKE '%trial%' OR duration_days = 1);
UPDATE plans SET slug = 'seven-days'    WHERE slug IS NULL AND duration_days = 7;
UPDATE plans SET slug = 'fifteen-days'  WHERE slug IS NULL AND duration_days = 15;
UPDATE plans SET slug = 'one-month'     WHERE slug IS NULL AND duration_days = 30;
UPDATE plans SET slug = 'three-months'  WHERE slug IS NULL AND duration_days = 90;
UPDATE plans SET slug = 'six-months'    WHERE slug IS NULL AND duration_days = 180;
UPDATE plans SET slug = 'one-year'      WHERE slug IS NULL AND duration_days >= 365;
UPDATE plans SET slug = 'plan-' || id   WHERE slug IS NULL;

-- Sync is_active with status
UPDATE plans SET is_active = true  WHERE is_active IS NULL AND COALESCE(status, 'active') = 'active';
UPDATE plans SET is_active = false WHERE is_active IS NULL AND status != 'active';

-- Mark most popular plans
UPDATE plans SET is_popular    = true WHERE duration_days = 30  AND is_popular IS NULL;
UPDATE plans SET is_best_value = true WHERE duration_days >= 365 AND is_best_value IS NULL;

-- Default sort order by duration
UPDATE plans SET sort_order = duration_days WHERE sort_order IS NULL OR sort_order = 0;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS device_limit INT;

-- Update slugs for existing plans to match the expected final slugs
UPDATE plans SET slug = 'trial-1-day' WHERE name ILIKE '%trial%' OR name ILIKE '%1 day%';
UPDATE plans SET slug = 'seven-days' WHERE name ILIKE '%7 day%' OR name ILIKE '%7 days%';
UPDATE plans SET slug = 'one-month' WHERE name ILIKE '%1 month%' OR name ILIKE '%monthly%';
UPDATE plans SET slug = 'three-months' WHERE name ILIKE '%3 month%' OR name ILIKE '%quarterly%';
UPDATE plans SET slug = 'six-months' WHERE name ILIKE '%6 month%' OR name ILIKE '%half%';
UPDATE plans SET slug = 'one-year' WHERE name ILIKE '%1 year%' OR name ILIKE '%yearly%';

-- Set remaining unsluggified plans based on duration
UPDATE plans SET slug = 'trial-1-day' WHERE slug IS NULL AND duration_days <= 1;
UPDATE plans SET slug = 'seven-days' WHERE slug IS NULL AND duration_days = 7;
UPDATE plans SET slug = 'one-month' WHERE slug IS NULL AND duration_days = 30;
UPDATE plans SET slug = 'three-months' WHERE slug IS NULL AND duration_days = 90;
UPDATE plans SET slug = 'six-months' WHERE slug IS NULL AND duration_days = 180;
UPDATE plans SET slug = 'one-year' WHERE slug IS NULL AND duration_days >= 365;

-- Update is_active to true for all currently active plans
UPDATE plans SET is_active = true WHERE is_active IS NULL AND status = 'active';

-- Sync device_limit with max_devices if needed
UPDATE plans SET device_limit = max_devices WHERE device_limit IS NULL;

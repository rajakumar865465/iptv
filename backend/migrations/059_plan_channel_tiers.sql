-- Migration 059: Add channel_tier and plan_tier columns
-- Enables the Starter / Pro / Plus tiered access control system.

-- 1. Add channel_tier to channels table
--    Values: 'free' (all plans), 'pro' (pro+plus plans), 'plus' (plus plan only)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_tier VARCHAR(20) DEFAULT 'free';

-- 2. Add plan_tier to plans table
--    Values: 'starter' (free channels only), 'pro' (free+pro), 'plus' (all channels)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) DEFAULT 'plus';

-- 3. Performance index
CREATE INDEX IF NOT EXISTS idx_channels_tier ON channels(channel_tier);
CREATE INDEX IF NOT EXISTS idx_plans_tier ON plans(plan_tier);

-- 4. Backfill existing plans with sensible defaults
--    Free trial → starter
UPDATE plans SET plan_tier = 'starter' WHERE price = 0;
--    1 Year annual → plus (premium access)
UPDATE plans SET plan_tier = 'plus' WHERE duration_days >= 365;
--    Everything else (monthly, 6-month) → pro by default until admin reconfigures
UPDATE plans SET plan_tier = 'pro' WHERE plan_tier = 'plus' AND duration_days < 365 AND price > 0;

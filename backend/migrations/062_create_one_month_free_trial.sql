-- Migration 062: Create 1-Month Free Trial Pro Plan (₹0) and track user trial status

-- 1. Track whether a user has already claimed their trial (prevent multiple free trials)
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_claimed_trial BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_has_claimed_trial ON users(has_claimed_trial);

-- 2. Backfill existing users who already claimed/used a trial license
UPDATE users SET has_claimed_trial = TRUE
WHERE id IN (
  SELECT DISTINCT l.user_id FROM licenses l
  JOIN plans p ON l.plan_id = p.id
  WHERE (p.price = 0 OR p.slug LIKE '%trial%') AND l.user_id IS NOT NULL
);

-- 3. Insert or update the 1-Month Free Trial Pro Plan
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM plans WHERE name = 'Pro Free Trial' OR slug = 'pro-free-trial') THEN
    UPDATE plans SET
      name = 'Pro Free Trial',
      slug = 'pro-free-trial',
      price = 0.00,
      regular_price = 79.00,
      duration_days = 30,
      max_devices = 1,
      description = '1 Month 100% Free Trial — All Free & Pro channels unlocked with 1 device access',
      status = 'active',
      is_visible = true,
      is_active = true,
      sort_order = 5,
      plan_tier = 'pro',
      offer_label = '100% FREE TRIAL'
    WHERE name = 'Pro Free Trial' OR slug = 'pro-free-trial';
  ELSE
    INSERT INTO plans (
      name, slug, price, regular_price, duration_days, max_devices,
      description, status, is_visible, is_active, sort_order, plan_tier, offer_label
    ) VALUES (
      'Pro Free Trial',
      'pro-free-trial',
      0.00,
      79.00,
      30,
      1,
      '1 Month 100% Free Trial — All Free & Pro channels unlocked with 1 device access',
      'active',
      true,
      true,
      5,
      'pro',
      '100% FREE TRIAL'
    );
  END IF;
END $$;

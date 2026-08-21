-- Migration: 057_manual_payment_system
-- Description: Adds orders, subscriptions tables for manual UPI workflow and updates plans.

-- 1. Add features JSONB column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- 2. Create orders table for manual UPI payments
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  order_id      VARCHAR(30) UNIQUE NOT NULL,  -- e.g. NIVA-20260821-8F42K
  user_id       INTEGER REFERENCES users(id),
  plan_id       INTEGER REFERENCES plans(id),
  amount        DECIMAL(10,2) NOT NULL,
  currency      VARCHAR(10) DEFAULT 'INR',
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  mobile        VARCHAR(20) NOT NULL,
  utr_number    VARCHAR(50) UNIQUE NOT NULL,
  payment_date  DATE,
  payment_note  TEXT,
  status        VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by   INTEGER REFERENCES users(id),
  approved_at   TIMESTAMP,
  rejected_at   TIMESTAMP,
  rejection_reason TEXT,
  submitted_at  TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_utr_number ON orders(utr_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 3. Create subscriptions table to manage active subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id     INTEGER REFERENCES plans(id),
  order_id    INTEGER REFERENCES orders(id),
  status      VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
  start_date  TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry_date ON subscriptions(expiry_date);

-- 4. Insert default payment mode into app_settings if not exists
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('payment_mode', 'manual')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Seed some basic plans if plans table is empty or update existing ones with basic features
DO $$
BEGIN
  -- We don't want to enforce new inserts if they rely on columns we don't have constraints on,
  -- but we can just let it do its thing.
  -- Or just skip since the admin can create plans. We will skip for safety.
END $$;

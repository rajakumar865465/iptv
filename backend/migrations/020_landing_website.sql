-- Migration 020: Landing website tables for public orders, APK releases, and license payment linking

-- Public orders (guest checkout, no user account required)
CREATE TABLE IF NOT EXISTS public_orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE NOT NULL,
  plan_id INTEGER REFERENCES plans(id),
  customer_name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(30) DEFAULT 'created',
  gateway_payment_id VARCHAR(200),
  gateway_signature VARCHAR(500),
  license_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- APK release management
CREATE TABLE IF NOT EXISTS app_releases (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  version_code INTEGER NOT NULL,
  apk_url TEXT NOT NULL,
  file_size VARCHAR(20),
  release_notes JSONB DEFAULT '[]',
  minimum_android_version VARCHAR(10) DEFAULT '7.0',
  is_latest BOOLEAN DEFAULT false,
  force_update BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend payments table for guest checkout
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR(500),
  ADD COLUMN IF NOT EXISTS approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Link licenses to payments
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS payment_id INTEGER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_public_orders_order_id ON public_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_public_orders_email ON public_orders(email);
CREATE INDEX IF NOT EXISTS idx_app_releases_is_latest ON app_releases(is_latest);

-- Migration 057: Manual UPI Payment + WhatsApp Verification + Admin Approval
--
-- Design notes (why this extends tables instead of adding new ones):
--   * "orders"        -> the existing `public_orders` table already is the website
--                       order ledger (Razorpay + free plans). Extending it keeps ONE
--                       order history for /my-account and one revenue source of truth.
--   * "subscriptions" -> the existing `licenses` table already IS the subscription
--                       record: a license key is what actually unlocks the NivaTV
--                       Android app. A separate `subscriptions` table would mark an
--                       order "approved" while the customer still had no access.
--   * "audit_logs"    -> the existing `admin_audit_logs` table.
--
-- Razorpay is NOT removed by this migration. Both flows coexist and the active one
-- is chosen by the admin-controlled `payment_mode` setting.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Manual-payment columns on public_orders
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public_orders
  ADD COLUMN IF NOT EXISTS payment_mode            VARCHAR(20) DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS utr_number              VARCHAR(64),
  -- Uppercased/whitespace-stripped copy of utr_number. Uniqueness is enforced on
  -- this so "  12345 abc " and "12345ABC" cannot both be submitted.
  ADD COLUMN IF NOT EXISTS utr_normalized          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS payment_date            DATE,
  ADD COLUMN IF NOT EXISTS payment_note            TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason        TEXT,
  -- Price is already snapshotted in public_orders.amount. Name/duration are
  -- snapshotted too so editing or deleting a plan later cannot retroactively
  -- change the terms a customer already paid for.
  ADD COLUMN IF NOT EXISTS plan_name_snapshot      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS duration_days_snapshot  INTEGER,
  ADD COLUMN IF NOT EXISTS max_devices_snapshot    INTEGER;

-- Existing rows all came from the Razorpay/free flow.
UPDATE public_orders SET payment_mode = 'razorpay' WHERE payment_mode IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Duplicate-UTR protection
-- ─────────────────────────────────────────────────────────────────────
-- Partial unique index: only manual orders carry a UTR, and NULLs are excluded so
-- the thousands of existing Razorpay rows don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_orders_utr_normalized
  ON public_orders (utr_normalized)
  WHERE utr_normalized IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Status domain
-- ─────────────────────────────────────────────────────────────────────
-- Added NOT VALID: enforced for every new/updated row without failing the
-- migration on any legacy row that predates this list.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_orders_status_check'
  ) THEN
    ALTER TABLE public_orders
      ADD CONSTRAINT public_orders_status_check
      CHECK (status IN (
        'created',    -- razorpay order created, not yet paid
        'paid',       -- razorpay payment verified
        'failed',     -- razorpay failure
        'pending',    -- manual: UTR submitted, awaiting admin verification
        'approved',   -- manual: admin verified payment in bank/UPI account
        'rejected',   -- manual: admin could not find the payment
        'cancelled',  -- abandoned by customer or admin
        'expired'     -- pending too long without verification
      )) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Indexes for the admin orders dashboard
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_public_orders_status        ON public_orders (status);
CREATE INDEX IF NOT EXISTS idx_public_orders_created_at    ON public_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_orders_user_id       ON public_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_public_orders_mobile        ON public_orders (mobile);
CREATE INDEX IF NOT EXISTS idx_public_orders_payment_mode  ON public_orders (payment_mode);
-- Covers the default dashboard view: pending manual orders, newest first.
CREATE INDEX IF NOT EXISTS idx_public_orders_mode_status_created
  ON public_orders (payment_mode, status, created_at DESC);

-- Approval extends an existing active subscription, which needs a fast
-- "latest active license for this user/email" lookup.
CREATE INDEX IF NOT EXISTS idx_licenses_user_status_expires
  ON licenses (user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_licenses_customer_email_lower
  ON licenses (LOWER(customer_email));

-- ─────────────────────────────────────────────────────────────────────
-- 5. Admin-controlled payment settings (no hardcoded UPI ID / WhatsApp number)
-- ─────────────────────────────────────────────────────────────────────
-- Default 'razorpay' so applying this migration does NOT silently switch a live
-- site over to manual collection. The admin flips it in the dashboard.
INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES
  ('payment_mode',                'razorpay',  NOW()),
  ('upi_merchant_name',           '',          NOW()),
  ('whatsapp_admin_number',       '',          NOW()),
  ('payment_currency',            'INR',       NOW()),
  ('manual_payment_instructions', '',          NOW()),
  -- 'true' => a renewal starts from the current expiry instead of today.
  ('subscription_stacking',       'true',      NOW())
ON CONFLICT (setting_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Retire the scaffolded parallel tables from the first implementation pass
-- ─────────────────────────────────────────────────────────────────────
-- Dropped ONLY when empty, so no data can ever be lost here. If either table has
-- rows, it is left untouched and must be migrated by hand.
DO $$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    EXECUTE 'SELECT COUNT(*) FROM subscriptions' INTO n;
    IF n = 0 THEN
      EXECUTE 'DROP TABLE subscriptions';
      RAISE NOTICE '057: dropped empty scaffold table "subscriptions" (licenses is the subscription record)';
    ELSE
      RAISE WARNING '057: table "subscriptions" has % row(s) — left in place, migrate manually', n;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'orders') THEN
    EXECUTE 'SELECT COUNT(*) FROM orders' INTO n;
    IF n = 0 THEN
      EXECUTE 'DROP TABLE orders';
      RAISE NOTICE '057: dropped empty scaffold table "orders" (public_orders is the order ledger)';
    ELSE
      RAISE WARNING '057: table "orders" has % row(s) — left in place, migrate manually', n;
    END IF;
  END IF;
END $$;

-- Migration 064: Create Coupons & Promotional Discount System
DO $$
BEGIN
    -- 1. Create coupons table
    CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
        discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
        min_order_amount NUMERIC(10, 2) DEFAULT 0,
        max_discount_amount NUMERIC(10, 2) NULL,
        plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        max_uses INTEGER NULL,
        used_count INTEGER DEFAULT 0,
        starts_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(LOWER(code));
    CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

    -- 2. Create coupon_redemptions table
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id SERIAL PRIMARY KEY,
        coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        order_id VARCHAR(100) NOT NULL,
        discount_amount NUMERIC(10, 2) NOT NULL,
        final_amount NUMERIC(10, 2) NOT NULL,
        redeemed_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);

    -- 3. Add coupon columns to public_orders if they do not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_orders' AND column_name = 'coupon_id') THEN
        ALTER TABLE public_orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_orders' AND column_name = 'coupon_code') THEN
        ALTER TABLE public_orders ADD COLUMN coupon_code VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_orders' AND column_name = 'original_amount') THEN
        ALTER TABLE public_orders ADD COLUMN original_amount NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_orders' AND column_name = 'discount_amount') THEN
        ALTER TABLE public_orders ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;

    -- 4. Seed initial launch promotional coupons
    INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, is_active)
    VALUES 
        ('WELCOME10', '10% discount on any subscription', 'percentage', 10.00, 0, true),
        ('SAVE50', 'Flat ₹50 discount on Pro & Plus plans', 'fixed', 50.00, 79.00, true),
        ('FESTIVE20', '20% special festive discount', 'percentage', 20.00, 100.00, true)
    ON CONFLICT (code) DO NOTHING;

END $$;

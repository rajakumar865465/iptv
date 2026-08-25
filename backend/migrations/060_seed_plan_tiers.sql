DO $$
BEGIN
    -- Insert Starter Monthly plan (if not already there as the existing 1 Month plan, update it)
    -- First, update the existing 1 Month plan to be Starter
    UPDATE plans SET plan_tier = 'starter', name = 'Starter Monthly', price = 49, max_devices = 1, sort_order = 10 WHERE duration_days = 30;

    -- Insert Pro Monthly plan (new)
    IF NOT EXISTS (SELECT 1 FROM plans WHERE duration_days = 30 AND plan_tier = 'pro') THEN
        INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible, slug, is_active, sort_order, plan_tier, is_popular, regular_price)
        VALUES ('Pro Monthly', 99, 30, 2, 'Pro plan with premium channels for 1 month', 'active', true, 'pro-monthly', true, 20, 'pro', true, 149);
    END IF;

    -- Update 6 Month plan to Starter 6-Month
    UPDATE plans SET plan_tier = 'starter', name = 'Starter 6 Months', price = 199, max_devices = 1, sort_order = 30 WHERE duration_days = 180;

    -- Insert Pro 6-Month plan (new)
    IF NOT EXISTS (SELECT 1 FROM plans WHERE duration_days = 180 AND plan_tier = 'pro') THEN
        INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible, slug, is_active, sort_order, plan_tier, regular_price)
        VALUES ('Pro 6 Months', 449, 180, 2, 'Pro plan with premium channels for 6 months', 'active', true, 'pro-6months', true, 40, 'pro', 699);
    END IF;

    -- Update 1 Year plan to Plus Annual
    UPDATE plans SET plan_tier = 'plus', name = 'Plus Annual', price = 799, max_devices = 4,
        is_best_value = true, sort_order = 50, offer_label = 'Family Plan', regular_price = 2999 WHERE duration_days >= 365;

    -- Update free trial to starter
    UPDATE plans SET plan_tier = 'starter' WHERE price = 0;

END $$;

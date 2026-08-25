DO $$
BEGIN
    -- 1. Insert or Update 6-Month Plan (Middle Ground Decoy)
    IF EXISTS (SELECT 1 FROM plans WHERE duration_days = 180) THEN
        UPDATE plans SET price = 499, max_devices = 2, is_visible = true, is_active = true, sort_order = 180 WHERE duration_days = 180;
    ELSE
        INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible, slug, is_active, sort_order)
        VALUES ('6 Months', 499, 180, 2, 'Half-yearly plan for 2 devices', 'active', true, 'six-months', true, 180);
    END IF;

    -- 2. Update 1-Year plan with Middle Ground pricing
    -- Set a good anchor regular_price (e.g. what 4 devices for 12 months would cost, but capped at 2999 to be realistic)
    UPDATE plans SET regular_price = 2999, price = 799, max_devices = 4, is_best_value = true, is_visible = true, is_active = true, sort_order = 365, offer_label = 'Family Plan' WHERE duration_days >= 365;

    -- 3. Update 1-Month plan with Middle Ground pricing
    UPDATE plans SET price = 99, max_devices = 1, is_visible = true, is_active = true, sort_order = 30, is_popular = true WHERE duration_days = 30;

    -- 4. Push others back in sort_order
    UPDATE plans SET sort_order = 100 WHERE duration_days NOT IN (30, 180) AND duration_days < 365;

END $$;

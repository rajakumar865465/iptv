DO $$
BEGIN
    -- 1. Insert or Update 6-Month Plan
    IF EXISTS (SELECT 1 FROM plans WHERE duration_days = 180) THEN
        UPDATE plans SET price = 599, max_devices = 2, is_visible = true, is_active = true, sort_order = 180 WHERE duration_days = 180;
    ELSE
        INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible, slug, is_active, sort_order)
        VALUES ('6 Months', 599, 180, 2, 'Half-yearly plan for 2 devices', 'active', true, 'six-months', true, 180);
    END IF;

    -- 2. Update 1-Year plan with massive regular_price and is_best_value
    UPDATE plans SET regular_price = 3312, price = 799, max_devices = 4, is_best_value = true, is_visible = true, is_active = true, sort_order = 365, offer_label = 'Family Plan' WHERE duration_days >= 365;

    -- 3. Update 1-Month plan
    UPDATE plans SET price = 69, max_devices = 1, is_visible = true, is_active = true, sort_order = 30, is_popular = true WHERE duration_days = 30;

    -- 4. Set 7 days / 15 days to invisible if we want only 3 plans to show up prominently, but we'll leave them if they exist.
    -- Or just let them be, since we want 1 Month, 6 Month, 1 Year to be the main ones.
    -- Actually, to ensure only these show up in the top 3 on homepage, let's update their sort_order to be 1, 2, 3.
    UPDATE plans SET sort_order = 10 WHERE duration_days = 30;
    UPDATE plans SET sort_order = 20 WHERE duration_days = 180;
    UPDATE plans SET sort_order = 30 WHERE duration_days >= 365;
    
    -- For others, push them back
    UPDATE plans SET sort_order = 100 WHERE duration_days NOT IN (30, 180) AND duration_days < 365;

END $$;

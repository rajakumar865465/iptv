-- 1. Link License 45 and Order 60 to User 2 (superadmin@nivatv.in)
UPDATE licenses SET user_id = 2 WHERE id = 45;
UPDATE public_orders SET user_id = 2 WHERE id = 60;

-- 2. Stack License 45 expiration date (+30 days on top of License 38 expiry: 2026-11-26 -> 2026-12-26)
UPDATE licenses 
SET expires_at = '2026-12-26 08:42:26.772+00' 
WHERE id = 45;

-- 3. Also auto-link any other orphaned licenses/orders matching superadmin email
UPDATE licenses SET user_id = 2 WHERE user_id IS NULL AND LOWER(customer_email) = 'superadmin@nivatv.in';
UPDATE public_orders SET user_id = 2 WHERE user_id IS NULL AND LOWER(email) = 'superadmin@nivatv.in';

-- 4. Check results
SELECT id, license_key, plan_id, user_id, customer_email, status, activated_at, expires_at FROM licenses WHERE user_id = 2 ORDER BY id DESC;
SELECT order_id, user_id, email, amount, status, license_id FROM public_orders WHERE user_id = 2 ORDER BY id DESC;

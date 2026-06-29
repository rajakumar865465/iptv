-- Migration 024: Add customer_email to licenses for guest (public) purchases
-- This allows the admin panel to show the buyer's email for licenses
-- created via the public payment flow (no user account required)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS customer_email VARCHAR(200);

-- Backfill existing licenses: pull email from public_orders via payments
UPDATE licenses l
SET customer_email = po.email
FROM payments pay
JOIN public_orders po ON po.gateway_payment_id = pay.transaction_id
WHERE l.payment_id = pay.id
  AND l.customer_email IS NULL
  AND l.user_id IS NULL;

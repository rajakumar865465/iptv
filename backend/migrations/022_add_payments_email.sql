-- Migration 022: Add missing email column to payments (expected by verifyPayment)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS email VARCHAR(200);
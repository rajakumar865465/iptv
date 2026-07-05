-- Migration 043: Fix missing license_type column on channel_streams
-- This column was originally added in 011 but was skipped if the table already existed (from 009).

ALTER TABLE channel_streams
ADD COLUMN IF NOT EXISTS license_type VARCHAR(30) DEFAULT 'free';

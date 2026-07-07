-- Migration 045: Add consecutive_scan_failures to channel_streams
-- Required for the scanner threshold fix (Fix 3): a stream must fail N consecutive
-- scans before being marked offline, preventing transient CDN hiccups from evicting
-- good streams.
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS consecutive_scan_failures INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN channel_streams.consecutive_scan_failures
  IS 'Number of consecutive scanner failures without a success. Reset to 0 on first working scan. Stream is only marked offline once this reaches OFFLINE_FAILURE_THRESHOLD (3).';

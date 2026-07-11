-- Migration 047: Fix stream scanner fields on channel_streams
-- Migration 032 incorrectly targeted a non-existent table named "streams"
-- instead of "channel_streams". This migration corrects that by applying
-- all the scanner and stability columns to the correct table.
-- All statements use ADD COLUMN IF NOT EXISTS and are fully idempotent.
-- Note: final_url, fail_count, success_count are already on channel_streams
--       (added by migrations 027 and 011), so they are intentionally omitted.

-- Part 1: Deep HLS segment scanner result fields
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS master_m3u8_load_success      BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS media_playlist_load_success   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS playlist_refresh_success      BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS segment_load_success_1        BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS segment_load_success_2        BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS segment_load_success_3        BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS segment_response_time         REAL      DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS segment_content_type          TEXT,
  ADD COLUMN IF NOT EXISTS segment_size                  INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redirects_followed            INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS required_headers              JSONB     DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS http_error_code               INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_expiry_detected         BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS html_error_page_detected      BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS geo_blocked                   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS drm_protected                 BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS codec_issue_detected          BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scanner_status                TEXT      DEFAULT 'unknown';

-- Part 2: Stream stability / playback tracking fields
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS startup_success_count    INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played_30s_count         INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played_2min_count        INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played_5min_count        INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffering_count          INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_buffer_duration      REAL      DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS segment_failure_count    INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_success_timestamp   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_timestamp   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stability_score          INTEGER   DEFAULT 0;

-- Part 3: Restream and legal source flags
ALTER TABLE channel_streams
  ADD COLUMN IF NOT EXISTS restream_enabled   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_legal_source    BOOLEAN   DEFAULT FALSE;

-- Index for scanner_status lookups
CREATE INDEX IF NOT EXISTS idx_channel_streams_scanner_status
  ON channel_streams(scanner_status) WHERE scanner_status IS NOT NULL;

-- Index for geo-blocked streams
CREATE INDEX IF NOT EXISTS idx_channel_streams_geo_blocked
  ON channel_streams(geo_blocked) WHERE geo_blocked = TRUE;

COMMENT ON COLUMN channel_streams.master_m3u8_load_success IS 'Whether the master M3U8 playlist loaded successfully during last scan';
COMMENT ON COLUMN channel_streams.stability_score IS 'Computed score (0-100) based on recent playback success/failure ratio';
COMMENT ON COLUMN channel_streams.scanner_status IS 'Last scanner result: unknown, working, offline, geo_blocked, drm_protected, token_expired, etc.';
COMMENT ON COLUMN channel_streams.geo_blocked IS 'True if stream returned a geo-restriction response during last scan';
COMMENT ON COLUMN channel_streams.is_legal_source IS 'True if the stream source is a verified legal broadcast';

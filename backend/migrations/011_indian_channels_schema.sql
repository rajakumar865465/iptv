-- 011_indian_channels_schema.sql
-- Adds all fields required for Indian stream import, health tracking, and logo caching

-- Extended channels table columns
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS display_name        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country             VARCHAR(10)  DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS source              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source_channel_id   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tvg_id              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_paid             BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_status       VARCHAR(30)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_reason       TEXT,
  ADD COLUMN IF NOT EXISTS health_score        INTEGER      DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_checked_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_success_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fail_count          INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS failure_reason      TEXT,
  ADD COLUMN IF NOT EXISTS user_agent          TEXT,
  ADD COLUMN IF NOT EXISTS referrer            TEXT,
  ADD COLUMN IF NOT EXISTS local_logo_url      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS logo_status         VARCHAR(30)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS logo_checked_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS logo_error          TEXT,
  ADD COLUMN IF NOT EXISTS active_stream_id    INTEGER,
  ADD COLUMN IF NOT EXISTS playback_mode       VARCHAR(20)  DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS has_backup_streams  BOOLEAN      DEFAULT false;

-- channel_streams: multi-stream support per channel
CREATE TABLE IF NOT EXISTS channel_streams (
  id               SERIAL PRIMARY KEY,
  channel_id       INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  stream_url       TEXT    NOT NULL,
  quality          VARCHAR(20)  DEFAULT 'auto',
  priority         INTEGER      DEFAULT 1,
  source_name      VARCHAR(100),
  user_agent       TEXT,
  referer          TEXT,
  license_type     VARCHAR(30)  DEFAULT 'free',
  health_status    VARCHAR(30)  DEFAULT 'unknown',
  health_reason    TEXT,
  health_score     INTEGER      DEFAULT 100,
  fail_count       INTEGER      DEFAULT 0,
  success_count    INTEGER      DEFAULT 0,
  last_checked_at  TIMESTAMP,
  last_success_at  TIMESTAMP,
  last_failed_at   TIMESTAMP,
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW(),
  UNIQUE(channel_id, stream_url)
);

CREATE INDEX IF NOT EXISTS idx_channel_streams_channel    ON channel_streams(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_streams_health     ON channel_streams(health_status);
CREATE INDEX IF NOT EXISTS idx_channels_health_status     ON channels(health_status);
CREATE INDEX IF NOT EXISTS idx_channels_country           ON channels(country);
CREATE INDEX IF NOT EXISTS idx_channels_source            ON channels(source);
CREATE INDEX IF NOT EXISTS idx_channels_tvg_id            ON channels(tvg_id);
CREATE INDEX IF NOT EXISTS idx_channels_language          ON channels(language);

-- Trigger: keep channel_streams.updated_at current
CREATE OR REPLACE FUNCTION update_channel_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_streams_updated_at ON channel_streams;
CREATE TRIGGER trg_channel_streams_updated_at
  BEFORE UPDATE ON channel_streams
  FOR EACH ROW EXECUTE FUNCTION update_channel_streams_updated_at();

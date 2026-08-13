-- Migration 052: M3U Channel Import & Validator (staged import sessions)
-- Separates parsing/scanning/duplicate-detection from writing to the live
-- `channels` table. Nothing here touches `channels` until an admin explicitly
-- imports selected items via the review UI.

CREATE TABLE IF NOT EXISTS channel_import_sessions (
  id                 SERIAL PRIMARY KEY,
  admin_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_type        VARCHAR(20) NOT NULL DEFAULT 'url', -- 'url' | 'text'
  source_url         TEXT,
  source_label       VARCHAR(255),        -- e.g. "iptv-org Hindi"
  default_language   VARCHAR(50),
  default_country    VARCHAR(10),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending -> parsed -> scanning -> scanned -> importing -> completed
  -- (or failed / cancelled at any point)
  total_found        INTEGER DEFAULT 0,
  total_checked      INTEGER DEFAULT 0,
  total_online        INTEGER DEFAULT 0,
  total_offline       INTEGER DEFAULT 0,
  total_unstable      INTEGER DEFAULT 0,
  total_unknown       INTEGER DEFAULT 0,
  total_duplicate     INTEGER DEFAULT 0,
  total_new           INTEGER DEFAULT 0,
  total_imported      INTEGER DEFAULT 0,
  total_skipped       INTEGER DEFAULT 0,
  error_message       TEXT,
  started_at          TIMESTAMP,
  scanned_at           TIMESTAMP,
  completed_at         TIMESTAMP,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_import_items (
  id                    SERIAL PRIMARY KEY,
  session_id            INTEGER NOT NULL REFERENCES channel_import_sessions(id) ON DELETE CASCADE,
  channel_name          VARCHAR(255) NOT NULL,
  name_normalized        VARCHAR(255),
  tvg_id                VARCHAR(255),
  tvg_name              VARCHAR(255),
  tvg_logo              TEXT,
  group_title           VARCHAR(255),
  language              VARCHAR(50),
  country               VARCHAR(10),
  source                VARCHAR(100) DEFAULT 'm3u-import',
  stream_url            TEXT NOT NULL,
  stream_url_normalized TEXT,
  user_agent            TEXT,
  referer               TEXT,

  -- Stream health: pending | checking | online | offline | unstable | unknown
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  response_time_ms      INTEGER,
  health_reason         VARCHAR(100),
  error_message         TEXT,
  checked_at            TIMESTAMP,

  -- Duplicate detection against the live `channels` table
  db_status             VARCHAR(20) NOT NULL DEFAULT 'unknown', -- new | duplicate | unknown
  duplicate_of_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  duplicate_reason       VARCHAR(50), -- exact_stream_url | tvg_id | normalized_name | normalized_url

  -- Admin selection / final outcome
  selected              BOOLEAN DEFAULT false,
  import_status         VARCHAR(20) DEFAULT 'pending', -- pending | imported | skipped_duplicate | skipped_offline | skipped
  imported_channel_id   INTEGER REFERENCES channels(id) ON DELETE SET NULL,

  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_items_session ON channel_import_items(session_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON channel_import_items(session_id, status);
CREATE INDEX IF NOT EXISTS idx_import_items_db_status ON channel_import_items(session_id, db_status);

CREATE OR REPLACE FUNCTION update_channel_import_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_import_sessions_updated_at ON channel_import_sessions;
CREATE TRIGGER trg_channel_import_sessions_updated_at
  BEFORE UPDATE ON channel_import_sessions
  FOR EACH ROW EXECUTE FUNCTION update_channel_import_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_channel_import_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_import_items_updated_at ON channel_import_items;
CREATE TRIGGER trg_channel_import_items_updated_at
  BEFORE UPDATE ON channel_import_items
  FOR EACH ROW EXECUTE FUNCTION update_channel_import_items_updated_at();

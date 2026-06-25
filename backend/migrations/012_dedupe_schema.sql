-- 012_dedupe_schema.sql
-- Adds canonical_name and merged_into fields for deduplication

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS canonical_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS merged_into_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_channels_canonical_name ON channels(canonical_name);
CREATE INDEX IF NOT EXISTS idx_channels_merged_into    ON channels(merged_into_channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_status_health  ON channels(status, health_status);

-- Backfill canonical_name for existing rows
-- Strips: HD, SD, 1080p, 720p, 576p, 480p, FHD, UHD, 4K, Live, TV, Channel,
--         Backup, Source N, (quality), trailing numbers after quality words
UPDATE channels
SET canonical_name = LOWER(
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name,
            '\s*\(.*?\)\s*', ' ', 'g'),               -- remove (anything)
          '\s*\b(hd|sd|fhd|uhd|4k)\b\s*', ' ', 'gi'), -- remove quality words
          '\s*\b(1080p?|720p?|576p?|480p?|360p?|240p?)\b\s*', ' ', 'gi'), -- remove resolution
        '\s*\b(backup|source\s*\d*|live|channel)\b\s*', ' ', 'gi'), -- remove suffix words
      '\s+', ' ', 'g')                                -- normalise spaces
  )
)
WHERE canonical_name IS NULL;

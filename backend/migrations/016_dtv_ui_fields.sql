-- 016_dtv_ui_fields.sql
-- Adds fields required for DTH-style OTT UI:
-- popularity scoring, popular flag, watch/favorite counts,
-- home section visibility, category sort order for ordered sections

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS is_popular          BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS popularity_score    INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_count         INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_count      INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_sort_order INTEGER  DEFAULT 999,
  ADD COLUMN IF NOT EXISTS home_section_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_home        BOOLEAN  DEFAULT true;

-- Indexes for new sort fields
CREATE INDEX IF NOT EXISTS idx_channels_popularity   ON channels(popularity_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_channels_watch_count  ON channels(watch_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_channels_is_popular   ON channels(is_popular);
CREATE INDEX IF NOT EXISTS idx_channels_show_on_home ON channels(show_on_home);
CREATE INDEX IF NOT EXISTS idx_channels_is_premium   ON channels(is_premium);
CREATE INDEX IF NOT EXISTS idx_channels_is_featured  ON channels(is_featured);

-- Composite index for the recommended sort used in home/channel API
CREATE INDEX IF NOT EXISTS idx_channels_recommended_sort
  ON channels(is_premium DESC, is_featured DESC, popularity_score DESC NULLS LAST, sort_order ASC NULLS LAST);

-- Seed initial popularity scores from existing watch_history data
UPDATE channels c
SET
  watch_count = COALESCE((
    SELECT COUNT(*) FROM watch_history wh WHERE wh.channel_id = c.id
  ), 0),
  favorite_count = COALESCE((
    SELECT COUNT(*) FROM favorites f WHERE f.channel_id = c.id
  ), 0);

UPDATE channels
SET popularity_score = (watch_count * 3) + (favorite_count * 5)
  + CASE WHEN is_featured = true THEN 50 ELSE 0 END;

-- Mark channels with popularity_score > 0 as popular
UPDATE channels
SET is_popular = true
WHERE popularity_score > 0 OR is_featured = true;

-- Categories: ensure DTH-style default sort order
-- (0 = first, high = last) — admin can override via dashboard
UPDATE categories SET sort_order = CASE
  WHEN LOWER(name) LIKE '%premium%'                                   THEN 1
  WHEN LOWER(name) LIKE '%popular%'                                   THEN 2
  WHEN LOWER(name) LIKE '%hindi entertainment%'
    OR (LOWER(name) LIKE '%hindi%' AND LOWER(name) LIKE '%entertain%') THEN 10
  WHEN LOWER(name) LIKE '%hindi movie%'
    OR (LOWER(name) LIKE '%hindi%' AND LOWER(name) LIKE '%movie%')    THEN 11
  WHEN LOWER(name) LIKE '%hindi news%'
    OR (LOWER(name) LIKE '%hindi%' AND LOWER(name) LIKE '%news%')     THEN 12
  WHEN LOWER(name) LIKE '%english news%'
    OR (LOWER(name) LIKE '%english%' AND LOWER(name) LIKE '%news%')   THEN 13
  WHEN LOWER(name) LIKE '%sport%'                                     THEN 20
  WHEN LOWER(name) LIKE '%kids%' OR LOWER(name) LIKE '%cartoon%'      THEN 25
  WHEN LOWER(name) LIKE '%music%'                                     THEN 30
  WHEN LOWER(name) LIKE '%devot%' OR LOWER(name) LIKE '%spiritual%'   THEN 35
  WHEN LOWER(name) LIKE '%doordarshan%' OR LOWER(name) LIKE '%dd %'   THEN 40
  WHEN LOWER(name) LIKE '%bengali%'                                   THEN 50
  WHEN LOWER(name) LIKE '%tamil%'                                     THEN 51
  WHEN LOWER(name) LIKE '%telugu%'                                    THEN 52
  WHEN LOWER(name) LIKE '%malayalam%'                                 THEN 53
  WHEN LOWER(name) LIKE '%kannada%'                                   THEN 54
  WHEN LOWER(name) LIKE '%marathi%'                                   THEN 55
  WHEN LOWER(name) LIKE '%punjabi%'                                   THEN 56
  WHEN LOWER(name) LIKE '%gujarati%'                                  THEN 57
  WHEN LOWER(name) LIKE '%odia%' OR LOWER(name) LIKE '%oriya%'        THEN 58
  WHEN LOWER(name) LIKE '%assam%'                                     THEN 59
  WHEN LOWER(name) LIKE '%urdu%'                                      THEN 60
  WHEN LOWER(name) LIKE '%bhojpuri%'                                  THEN 61
  WHEN LOWER(name) LIKE '%news%'                                      THEN 70
  ELSE sort_order  -- keep existing value if not matched
END
WHERE 1=1;

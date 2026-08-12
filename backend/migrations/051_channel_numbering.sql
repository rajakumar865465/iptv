-- 051_channel_numbering.sql
-- Permanent channel numbers + genre super-block bucketing.
--
-- Adds two columns:
--   channel_number  INTEGER  — permanent, unique number (see genre blocks below)
--   genre           VARCHAR  — coarse 9-genre facet the number is derived from
--
-- Assignment is NOT done here. The genre→number logic lives in ONE place —
-- backend/src/utils/channelNumbering.js (assignChannelNumbers) — which runs on
-- startup and after import scripts. Keeping only column DDL here avoids
-- duplicating the mapping logic in SQL.
--
-- Genre blocks (base .. base+99):
--   001-099 News · 100-199 Entertainment · 200-299 Movies · 300-399 Sports ·
--   400-499 Music · 500-599 Kids · 600-699 Regional · 700-799 Devotional ·
--   800-899 International · 900+ Other · 9000+ overflow spill pool

ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS channel_number INTEGER,
    ADD COLUMN IF NOT EXISTS genre          VARCHAR(40);

-- Fast lookups for sort=number and genre filtering / grouping.
CREATE INDEX IF NOT EXISTS idx_channels_channel_number ON channels (channel_number);
CREATE INDEX IF NOT EXISTS idx_channels_genre          ON channels (genre);

-- Guard against accidental duplicate numbers (NULLs are allowed and not unique-checked).
CREATE UNIQUE INDEX IF NOT EXISTS uq_channels_channel_number
    ON channels (channel_number)
    WHERE channel_number IS NOT NULL;

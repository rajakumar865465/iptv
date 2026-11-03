-- 065_renumber_channels_sequential.sql
-- Renumber all channels cleanly and sequentially (1, 2, 3, 4...) ordered by name.
-- Completely purges overflow spill numbers (9000+) and block gaps.

BEGIN;

-- 1) Clear all existing channel numbers to avoid unique constraint violations during update
UPDATE channels SET channel_number = NULL;

-- 2) Sequentially number all active & visible channels (1, 2, 3, 4...) ordered alphabetically
WITH ranked_visible AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS seq
  FROM channels
  WHERE is_visible_app = true AND status = 'active'
)
UPDATE channels c
SET channel_number = ranked_visible.seq
FROM ranked_visible
WHERE c.id = ranked_visible.id;

-- 3) Sequentially number any remaining channels (inactive or hidden) continuing from max seq
WITH max_seq AS (
  SELECT COALESCE(MAX(channel_number), 0) AS max_num FROM channels
),
ranked_remaining AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) + (SELECT max_num FROM max_seq) AS seq
  FROM channels
  WHERE channel_number IS NULL
)
UPDATE channels c
SET channel_number = ranked_remaining.seq
FROM ranked_remaining
WHERE c.id = ranked_remaining.id;

COMMIT;

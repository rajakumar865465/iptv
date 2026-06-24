-- Backfill language column for existing channels based on their category
-- This fixes channels imported with language = NULL

UPDATE channels
SET language = CASE
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%hindi%') THEN 'Hindi'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%english%') THEN 'English'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%bengali%') THEN 'Bengali'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%tamil%') THEN 'Tamil'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%telugu%') THEN 'Telugu'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%malayalam%') THEN 'Malayalam'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%kannada%') THEN 'Kannada'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%marathi%') THEN 'Marathi'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%punjabi%') THEN 'Punjabi'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%gujarati%') THEN 'Gujarati'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%odia%') THEN 'Odia'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%assamese%') THEN 'Assamese'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%urdu%') THEN 'Urdu'
  WHEN category_id IN (SELECT id FROM categories WHERE name ILIKE '%doordarshan%') THEN 'Hindi'
  ELSE 'Hindi'
END
WHERE language IS NULL OR language = '';

-- Add is_visible_public and slug to categories table

-- Add is_visible_public for controlling public visibility
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible_public BOOLEAN DEFAULT true;

-- Add slug for URL-friendly category names
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible_public);

-- Populate slug values based on existing names
UPDATE categories
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '-', 'g'))
WHERE slug IS NULL;

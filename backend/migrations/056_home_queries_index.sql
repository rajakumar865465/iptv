-- 056_home_queries_index.sql
-- Indexes to optimize complex home section and channel listing queries

CREATE INDEX IF NOT EXISTS idx_channels_home_featured 
ON channels (status, is_hidden, is_removed, is_visible_app, is_featured, popularity_score DESC NULLS LAST, sort_order ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_channels_home_popular 
ON channels (status, is_hidden, is_removed, is_visible_app, is_popular, popularity_score DESC NULLS LAST, watch_count DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_channels_home_category 
ON channels (category_id, status, is_hidden, is_removed, is_visible_app);

CREATE INDEX IF NOT EXISTS idx_channels_home_premium
ON channels (status, is_hidden, is_removed, is_visible_app, is_premium);

-- Add new columns for per-channel display configuration
ALTER TABLE channels ADD COLUMN default_fit_mode VARCHAR(20) DEFAULT 'original';
ALTER TABLE channels ADD COLUMN aspect_ratio_type VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN has_internal_black_bars BOOLEAN DEFAULT FALSE;
ALTER TABLE channels ADD COLUMN fit_note TEXT;
ALTER TABLE channels ADD COLUMN player_display_status VARCHAR(50);

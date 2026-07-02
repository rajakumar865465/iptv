
-- Add fields for deep HLS segment scanner results
ALTER TABLE streams
ADD COLUMN master_m3u8_load_success BOOLEAN DEFAULT FALSE,
ADD COLUMN media_playlist_load_success BOOLEAN DEFAULT FALSE,
ADD COLUMN playlist_refresh_success BOOLEAN DEFAULT FALSE,
ADD COLUMN segment_load_success_1 BOOLEAN DEFAULT FALSE,
ADD COLUMN segment_load_success_2 BOOLEAN DEFAULT FALSE,
ADD COLUMN segment_load_success_3 BOOLEAN DEFAULT FALSE,
ADD COLUMN segment_response_time REAL DEFAULT 0.0,
ADD COLUMN segment_content_type TEXT,
ADD COLUMN segment_size INTEGER DEFAULT 0,
ADD COLUMN redirects_followed INTEGER DEFAULT 0,
ADD COLUMN final_url TEXT,
ADD COLUMN required_headers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN http_error_code INTEGER DEFAULT 0,
ADD COLUMN token_expiry_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN html_error_page_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN geo_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN drm_protected BOOLEAN DEFAULT FALSE,
ADD COLUMN codec_issue_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN scanner_status TEXT DEFAULT 'unknown';

-- Add fields for stream stability score
ALTER TABLE streams
ADD COLUMN startup_success_count INTEGER DEFAULT 0,
ADD COLUMN played_30s_count INTEGER DEFAULT 0,
ADD COLUMN played_2min_count INTEGER DEFAULT 0,
ADD COLUMN played_5min_count INTEGER DEFAULT 0,
ADD COLUMN buffering_count INTEGER DEFAULT 0,
ADD COLUMN avg_buffer_duration REAL DEFAULT 0.0,
ADD COLUMN segment_failure_count INTEGER DEFAULT 0,
ADD COLUMN fail_count INTEGER DEFAULT 0,
ADD COLUMN success_count INTEGER DEFAULT 0,
ADD COLUMN last_success_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_failure_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN stability_score INTEGER DEFAULT 0;

-- Add fields for backup stream requirement and important channels
ALTER TABLE channels
ADD COLUMN is_important BOOLEAN DEFAULT FALSE,
ADD COLUMN needs_manual_verification BOOLEAN DEFAULT FALSE,
ADD COLUMN manual_verification_reason TEXT;

-- Add field for restream_enabled and is_legal_source to streams
ALTER TABLE streams
ADD COLUMN restream_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN is_legal_source BOOLEAN DEFAULT FALSE;

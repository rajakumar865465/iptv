-- IPTV Live TV - Seed Data
-- Created: 2026-06-23

-- Insert default app settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
('maintenance_mode', 'false'),
('force_update', 'false'),
('minimum_app_version', '1.0.0'),
('signup_enabled', 'true'),
('payment_enabled', 'true'),
('trial_enabled', 'true'),
('support_whatsapp', 'https://wa.me/911234567890'),
('support_email', 'support@iptvapp.com'),
('privacy_policy_url', 'https://iptvapp.com/privacy'),
('terms_url', 'https://iptvapp.com/terms'),
('announcement_message', ''),
('banner_message', ''),
('ads_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default plans
INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible, sort_order) VALUES
('1 Day Trial', 0, 1, 1, 'Free trial for 1 day to test the service', 'active', true, 1),
('7 Days', 49, 7, 1, 'One week access to all channels', 'active', true, 2),
('1 Month', 149, 30, 2, 'Full month access on up to 2 devices', 'active', true, 3),
('3 Months', 399, 90, 3, 'Quarterly plan with access on up to 3 devices', 'active', true, 4),
('6 Months', 699, 180, 3, 'Half yearly plan - best value', 'active', true, 5),
('1 Year', 1199, 365, 5, 'Full year access on up to 5 devices - best deal', 'active', true, 6)
ON CONFLICT DO NOTHING;

-- Insert sample categories
INSERT INTO categories (name, icon_url, status, sort_order) VALUES
('News', '', 'active', 1),
('Sports', '', 'active', 2),
('Movies', '', 'active', 3),
('Music', '', 'active', 4),
('Kids', '', 'active', 5),
('Entertainment', '', 'active', 6),
('Regional', '', 'active', 7),
('Documentary', '', 'active', 8),
('Religious', '', 'active', 9),
('International', '', 'active', 10)
ON CONFLICT DO NOTHING;

-- Insert sample channels (using category IDs 1-10, adjust as needed)
-- Note: Actual stream URLs should be replaced with legal/valid streams
INSERT INTO channels (name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order) VALUES
('Star Sports 1', '', 'https://example.com/stream/starsports1.m3u8', '', 2, 'Hindi', 'HD', 'active', true, true, 1),
('Sony TV', '', 'https://example.com/stream/sonytv.m3u8', '', 6, 'Hindi', 'HD', 'active', true, false, 2),
('Zee News', '', 'https://example.com/stream/zeenews.m3u8', '', 1, 'Hindi', 'HD', 'active', false, false, 3),
('Colors TV', '', 'https://example.com/stream/colorstv.m3u8', '', 6, 'Hindi', 'HD', 'active', true, false, 4),
('Discovery', '', 'https://example.com/stream/discovery.m3u8', '', 8, 'English', 'HD', 'active', false, true, 5),
('MTV India', '', 'https://example.com/stream/mtvindia.m3u8', '', 4, 'Hindi', 'HD', 'active', false, false, 6),
('Cartoon Network', '', 'https://example.com/stream/cn.m3u8', '', 5, 'Hindi', 'HD', 'active', true, true, 7),
('DD National', '', 'https://example.com/stream/ddnational.m3u8', '', 7, 'Hindi', 'SD', 'active', false, false, 8),
('Aaj Tak', '', 'https://example.com/stream/aajtak.m3u8', '', 1, 'Hindi', 'HD', 'active', false, false, 9),
('Star Gold', '', 'https://example.com/stream/stargold.m3u8', '', 3, 'Hindi', 'HD', 'active', true, true, 10)
ON CONFLICT DO NOTHING;

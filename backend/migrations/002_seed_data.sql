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
INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible) VALUES
('1 Day Trial', 0, 1, 1, 'Free trial for 1 day to test the service', 'active', true),
('7 Days', 49, 7, 1, 'One week access to all channels', 'active', true),
('1 Month', 149, 30, 2, 'Full month access on up to 2 devices', 'active', true),
('3 Months', 399, 90, 3, 'Quarterly plan with access on up to 3 devices', 'active', true),
('6 Months', 699, 180, 3, 'Half yearly plan - best value', 'active', true),
('1 Year', 1199, 365, 5, 'Full year access on up to 5 devices - best deal', 'active', true)
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

-- Insert test license (for app testing)
INSERT INTO licenses (license_key, plan_id, user_id, status, duration_days, max_devices) VALUES
('TEST-LICENSE-2026', NULL, NULL, 'unused', 30, 2)
ON CONFLICT (license_key) DO NOTHING;

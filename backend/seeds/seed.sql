-- Seed app settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
('maintenance_mode', 'false'),
('force_update', 'false'),
('minimum_app_version', '1.0.0'),
('signup_enabled', 'true'),
('payment_enabled', 'true'),
('trial_enabled', 'true'),
('support_whatsapp', '+919999999999'),
('support_email', 'support@example.com'),
('privacy_policy_url', 'https://example.com/privacy'),
('terms_url', 'https://example.com/terms'),
('announcement_message', ''),
('banner_message', ''),
('ads_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;

-- Seed plans
INSERT INTO plans (name, price, duration_days, max_devices, description, status, is_visible) VALUES
('1 Day Trial', 0, 1, 1, 'Free trial for 1 day', 'active', true),
('7 Days Plan', 49, 7, 2, 'Weekly plan', 'active', true),
('15 Days Plan', 99, 15, 2, 'Biweekly plan', 'active', true),
('1 Month Plan', 199, 30, 3, 'Monthly plan', 'active', true),
('3 Months Plan', 499, 90, 4, 'Quarterly plan', 'active', true),
('6 Months Plan', 899, 180, 5, 'Half-yearly plan', 'active', true),
('1 Year Plan', 1499, 365, 6, 'Yearly plan', 'active', true)
ON CONFLICT DO NOTHING;

-- Seed categories
INSERT INTO categories (name, icon_url, status, sort_order) VALUES
('News', 'https://example.com/icons/news.png', 'active', 1),
('Sports', 'https://example.com/icons/sports.png', 'active', 2),
('Movies', 'https://example.com/icons/movies.png', 'active', 3),
('Music', 'https://example.com/icons/music.png', 'active', 4),
('Kids', 'https://example.com/icons/kids.png', 'active', 5),
('Entertainment', 'https://example.com/icons/entertainment.png', 'active', 6),
('Regional', 'https://example.com/icons/regional.png', 'active', 7),
('Religious', 'https://example.com/icons/religious.png', 'active', 8),
('Education', 'https://example.com/icons/education.png', 'active', 9),
('Documentary', 'https://example.com/icons/documentary.png', 'active', 10),
('International', 'https://example.com/icons/international.png', 'active', 11);

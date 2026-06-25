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

-- Seed Indian Channel Categories
INSERT INTO categories (name, icon_url, status, sort_order) VALUES
('Hindi News', 'https://example.com/icons/hindi-news.png', 'active', 1),
('English News', 'https://example.com/icons/english-news.png', 'active', 2),
('Bengali', 'https://example.com/icons/bengali.png', 'active', 3),
('Hindi Entertainment', 'https://example.com/icons/hindi-entertainment.png', 'active', 4),
('Hindi Movies', 'https://example.com/icons/hindi-movies.png', 'active', 5),
('Sports', 'https://example.com/icons/sports.png', 'active', 6),
('Music', 'https://example.com/icons/music.png', 'active', 7),
('Kids', 'https://example.com/icons/kids.png', 'active', 8),
('Devotional', 'https://example.com/icons/devotional.png', 'active', 9),
('Education', 'https://example.com/icons/education.png', 'active', 10),
('Tamil', 'https://example.com/icons/tamil.png', 'active', 11),
('Telugu', 'https://example.com/icons/telugu.png', 'active', 12),
('Malayalam', 'https://example.com/icons/malayalam.png', 'active', 13),
('Kannada', 'https://example.com/icons/kannada.png', 'active', 14),
('Marathi', 'https://example.com/icons/marathi.png', 'active', 15),
('Punjabi', 'https://example.com/icons/punjabi.png', 'active', 16),
('Gujarati', 'https://example.com/icons/gujarati.png', 'active', 17),
('Odia', 'https://example.com/icons/odia.png', 'active', 18),
('Assamese', 'https://example.com/icons/assamese.png', 'active', 19),
('Urdu', 'https://example.com/icons/urdu.png', 'active', 20),
('Doordarshan', 'https://example.com/icons/doordarshan.png', 'active', 21),
('Business News', 'https://example.com/icons/business-news.png', 'active', 22),
('International News', 'https://example.com/icons/international-news.png', 'active', 23)
ON CONFLICT (name) DO NOTHING;

-- Seed test license
INSERT INTO licenses (license_key, plan_id, user_id, status, duration_days, max_devices)
VALUES ('TEST-LICENSE-2026', NULL, NULL, 'unused', 30, 2)
ON CONFLICT (license_key) DO NOTHING;

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

-- Seed test license
INSERT INTO licenses (license_key, plan_id, user_id, status, duration_days, max_devices)
VALUES ('TEST-LICENSE-2026', NULL, NULL, 'unused', 30, 2)
ON CONFLICT (license_key) DO NOTHING;

-- Seed Indian IPTV channels with public M3U8 streams
INSERT INTO channels (name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order) VALUES
-- News (category_id=1)
('DD News', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/DD_News_logo.svg/1200px-DD_News_logo.svg.png',
 'https://ddhlshttps.akamaized.net/ddnews/index.m3u8', NULL, 1, 'Hindi', 'HD', 'active', true, false, 1),
('Aaj Tak', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Aaj_Tak_logo.svg/1200px-Aaj_Tak_logo.svg.png',
 'https://feeds.int.nxtv.in/pdf/aajtakhdd/1_prd.m3u8', NULL, 1, 'Hindi', 'HD', 'active', true, false, 2),
('Republic TV', 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Republic_TV_logo.svg/1200px-Republic_TV_logo.svg.png',
 'https://republictv.in/live/v1/republictv.m3u8', NULL, 1, 'English', 'HD', 'active', true, false, 3),
('Times Now', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Times_Now_logo.svg/1200px-Times_Now_logo.svg.png',
 'https://timesnownews.com/', NULL, 1, 'English', 'HD', 'active', false, false, 4),

-- Sports (categoryspring_id=2)
('DD Sports', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/DD_Sports_logo.svg/1200px-DD_Sports_logo.svg.png',
 'https://d2q8p4pi5y13qc.cloudfront.net/out/v1/8d81046f3a5641518f1e7b7ed8e9e7e2/index_1.m3u8', NULL, 2, 'Hindi', 'HD', 'active', true, false, 1),
('Star Sports 1', 'https://upload.wikimedia.org/wikipedia/en/thumb/2/22/Star_Sports_1_logo.svg/1200px-Star_Sports_1_logo.svg.png',
 'https://hotstar.com/sports', NULL, 2, 'Hindi', 'HD', 'active', true, true, 2),
('Sony Ten 1', 'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Sony_Six_logo.svg/1200px-Sony_Six_logo.svg.png',
 'https://sonyliv.com/sports', NULL, 2, 'Hindi', 'HD', 'active', true, true, 3),

-- Entertainment (category_id=6)
('Colors HD', 'https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Colors_TV_logo.svg/1200px-Colors_TV_logo.svg.png',
 'https://colors.in/live/v1/colors.m3u8', NULL, 6, 'Hindi', 'HD', 'active', true, true, 1),
('Star Plus', 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Plus_logo.svg/1200px-Star_Plus_logo.svg.png',
 'https://hotstar.com/entertainment', NULL, 6, 'Hindi', 'HD', 'active', true, true, 2),
('Sony TV HD', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Sony_Entertainment_Television_logo.svg/1200px-Sony_Entertainment_Television_logo.svg.png',
 'https://sonyliv.com/entertainment', NULL, 6, 'Hindi', 'HD', 'active', true, true, 3),
('Zee TV', 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/Zee_TV_logo.svg/1200px-Zee_TV_logo.svg.png',
 'https://zee5.com/live-tv/zee-tv-hd/0-9-zeetvhd', NULL, 6, 'Hindi', 'HD', 'active', true, true, 4),

-- Movies (category_id=3)
('Star Gold', 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Star_Gold_logo.svg/1200px-Star_Gold_logo.svg.png',
 'https://hotstar.com/movies', NULL, 3, 'Hindi', 'HD', 'active', true, true, 1),
('Sony Max', 'https://upload.wikimedia.org/wikipedia/en/thumb/7/78/Sony_Max_logo.svg/1200px-Sony_Max_logo.svg.png',
 'https://sonyliv.com/movies', NULL, 3, 'Hindi', 'HD', 'active', true, true, 2),
('Zee Cinema', 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Zee_Cinema_logo.svg/1200px-Zee_Cinema_logo.svg.png',
 'https://zee5.com/live-tv/zee-cinema/0-9-zeecinema', NULL, 3, 'Hindi', 'HD', 'active', true, true, 3),

-- Regional (category_id=7)
('Sun TV', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sun_TV_logo.svg/1200px-Sun_TV_logo.svg.png',
 'https://sunnxt.com/', NULL, 7, 'Tamil', 'HD', 'active', true, true, 1),
('Zee Tamil', 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/Zee_Tamil_logo.svg/1200px-Zee_Tamil_logo.svg.png',
 'https://zee5.com/live-tv/zee-tamil/0-9-zeetamil', NULL, 7, 'Tamil', 'HD', 'active', true, true, 2),
('Asianet', 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Asianet_Logo.svg/1200px-Asianet_Logo.svg.png',
 'https://hotstar.com/regional', NULL, 7, 'Malayalam', 'HD', 'active', true, true, 3),
('Zee Telugu', 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/Zee_Telugu_logo.svg/1200px-Zee_Telugu_logo.svg.png',
 'https://zee5.com/live-tv/zee-telugu/0-9-zeetelugu', NULL, 7, 'Telugu', 'HD', 'active', true, true, 4),

-- Music (category_id=4)
('MTV India', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/MTV_Logo_2010.svg/1200px-MTV_Logo_2010.svg.png',
 'https://voot.com/music', NULL, 4, 'Hindi', 'HD', 'active', true, true, 1),
('9XM', 'https://upload.wikimedia.org/wikipedia/en/thumb/5/57/9XM_logo.svg/1200px-9XM_logo.svg.png',
 'https://9xm.in/', NULL, 4, 'Hindi', 'SD', 'active', true, false, 2),

-- Kids (category_id=5)
('Nickelodeon', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Nickelodeon_2023_logo.svg/1200px-Nickelodeon_2023_logo.svg.png',
 'https://voot.com/kids', NULL, 5, 'Hindi', 'HD', 'active', true, true, 1),
('Cartoon Network', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Cartoon_Network_2010_logo.svg/1200px-Cartoon_Network_2010_logo.svg.png',
 'https://voot.com/kids', NULL, 5, 'English', 'HD', 'active', true, true, 2),
('Pogo', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Pogo_logo.svg/1200px-Pogo_logo.svg.png',
 'https://voot.com/kids', NULL, 5, 'Hindi', 'SD', 'active', false, true, 3),

-- Documentary (category_id=10)
('Discovery Channel', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Discovery_Channel_logo.svg/1200px-Discovery_Channel_logo.svg.png',
 'https://tataplay.com/discovery', NULL, 10, 'English', 'HD', 'active', true, true, 1),
('National Geographic', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/National_Geographic_Channel_logo.svg/1200px-National_Geographic_Channel_logo.svg.png',
 'https://tataplay.com/national-geographic', NULL, 10, 'English', 'HD', 'active', true, true, 2),

-- International (category_id=11)
('BBC World News', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_World_News_2022.svg/1200px-BBC_World_News_2022.svg.png',
 'https://bbc.com/news', NULL, 11, 'English', 'HD', 'active', true, true, 1),
('CNN International', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/CNN_logo.svg/1200px-CNN_logo.svg.png',
 'https://cnn.com/international', NULL, 11, 'English', 'HD', 'active', true, true, 2),
('Al Jazeera', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Al_Jazeera_logo.svg/1200px-Al_Jazeera_logo.svg.png',
 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8', NULL, 11, 'English', 'HD', 'active', true, false, 3)
ON CONFLICT DO NOTHING;

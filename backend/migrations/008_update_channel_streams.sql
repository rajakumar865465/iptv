-- Migration 008: Update channel stream URLs with working streams from iptv-org
-- Source: https://github.com/iptv-org/iptv/blob/master/streams/in.m3u
-- Updated: 2026-06-24

-- ============================================================
-- STEP 1: Ensure all necessary categories exist
-- ============================================================
INSERT INTO categories (name, icon_url, status, sort_order)
SELECT val.name, val.icon_url, val.status, val.sort_order 
FROM (VALUES 
  ('Hindi Entertainment', '', 'active', 1),
  ('Hindi News',          '', 'active', 2),
  ('Hindi Movies',        '', 'active', 3),
  ('Sports',              '', 'active', 4),
  ('Music',               '', 'active', 5),
  ('Kids',                '', 'active', 6),
  ('Devotional',          '', 'active', 7),
  ('Tamil',               '', 'active', 8),
  ('Telugu',              '', 'active', 9),
  ('Malayalam',           '', 'active', 10),
  ('Kannada',             '', 'active', 11),
  ('Bengali',             '', 'active', 12),
  ('Marathi',             '', 'active', 13),
  ('Punjabi',             '', 'active', 14),
  ('Gujarati',            '', 'active', 15),
  ('English News',        '', 'active', 16),
  ('Business News',       '', 'active', 17),
  ('Doordarshan',         '', 'active', 18),
  ('Regional',            '', 'active', 19)
) AS val(name, icon_url, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.name = val.name
);

-- ============================================================
-- STEP 2: Clear existing channels and re-insert fresh ones
-- ============================================================
DELETE FROM channels;

-- ============================================================
-- STEP 3: Insert channels with working stream URLs
-- ============================================================

-- HINDI ENTERTAINMENT
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Plus', 'http://103.72.101.252:8080/live/10.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Star_Plus_new_logo.svg/320px-Star_Plus_new_logo.svg.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Zee TV', 'http://103.72.101.252:8080/live/1.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Zee_TV.svg/320px-Zee_TV.svg.png',
  id, 'Hindi', 'active', true, 2 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Sony Entertainment', 'http://103.72.101.252:8080/live/11.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sony_Entertainment_Television_India_2017.svg/320px-Sony_Entertainment_Television_India_2017.svg.png',
  id, 'Hindi', 'active', true, 3 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors', 'http://103.72.101.252:8080/live/1368.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Colors_TV.svg/320px-Colors_TV.svg.png',
  id, 'Hindi', 'active', true, 4 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '&TV', 'https://amg01117-amg01117c1-amgplt0029.playout.now3.amagi.tv/playlist/amg01117-amg01117c1-amgplt0029/playlist.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Hindi', 'active', false, 5 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Dangal TV', 'https://live-dangal.akamaized.net/liveabr/playlist.m3u8',
  'https://i.imgur.com/W7L8bTH.png',
  id, 'Hindi', 'active', false, 6 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Dangal 2', 'https://live-dangal2.akamaized.net/liveabr/playlist.m3u8',
  'https://i.imgur.com/W7L8bTH.png',
  id, 'Hindi', 'active', false, 7 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;

-- HINDI MOVIES
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Zee Cinema', 'http://103.72.101.252:8080/live/5.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Zee_Cinema.svg/320px-Zee_Cinema.svg.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Hindi Movies' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Sony Max', 'http://103.72.101.252:8080/live/17.m3u8',
  'https://i.imgur.com/1rJfNGe.png',
  id, 'Hindi', 'active', true, 2 FROM categories WHERE name = 'Hindi Movies' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Gold', 'http://103.72.101.252:8080/live/12.m3u8',
  'https://i.imgur.com/Ogl5aG0.png',
  id, 'Hindi', 'active', true, 3 FROM categories WHERE name = 'Hindi Movies' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Cineplex', 'http://103.122.249.134:8000/play/a058',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Hindi', 'active', false, 4 FROM categories WHERE name = 'Hindi Movies' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Bhojpuri Cinema', 'https://live-bhojpuri.akamaized.net/liveabr/playlist.m3u8',
  'https://i.imgur.com/5kzLSiT.png',
  id, 'Hindi', 'active', false, 5 FROM categories WHERE name = 'Hindi Movies' LIMIT 1;

-- HINDI NEWS
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aaj Tak', 'https://feeds.intoday.in/aajtak/api/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Aaj_Tak_logo.svg/320px-Aaj_Tak_logo.svg.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aaj Tak HD', 'https://feeds.intoday.in/aajtak/api/aajtakhd/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Aaj_Tak_logo.svg/320px-Aaj_Tak_logo.svg.png',
  id, 'Hindi', 'active', false, 2 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'ABP News', 'https://d2l4ar6y3mrs4k.cloudfront.net/live-streaming/abpnews-livetv/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/ABP_News_Logo.png/320px-ABP_News_Logo.png',
  id, 'Hindi', 'active', true, 3 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'News18 India', 'https://n18syndication.akamaized.net/bpk-tv/News18_India_NW18_MOB/output01/master.m3u8',
  'https://i.imgur.com/qRvkWh1.png',
  id, 'Hindi', 'active', true, 4 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Zee News', 'http://103.213.31.109:90/ZeeNews/playlist.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Zee_News_logo.svg/320px-Zee_News_logo.svg.png',
  id, 'Hindi', 'active', true, 5 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'India TV', 'https://p-live-pubv2.tataplaybinge.com/IndiaTV_HD/IndiaTV_HD.m3u8',
  'https://i.imgur.com/fhh9N7w.png',
  id, 'Hindi', 'active', false, 6 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'BT TV', 'https://feeds.intoday.in/bttv/itgd.m3u8',
  'https://i.imgur.com/fhh9N7w.png',
  id, 'Hindi', 'active', false, 7 FROM categories WHERE name = 'Hindi News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Bharat 24', 'https://cdn.ottlive.co.in/bharat24/index.fmp4.m3u8',
  'https://i.imgur.com/VaLRUJI.png',
  id, 'Hindi', 'active', false, 8 FROM categories WHERE name = 'Hindi News' LIMIT 1;

-- SPORTS
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Sports 1', 'http://103.72.101.252:8080/live/33.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Star_Sports_1_logo.svg/320px-Star_Sports_1_logo.svg.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Sports' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Sports 2', 'http://103.72.101.252:8080/live/35.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Star_Sports_2_logo.svg/320px-Star_Sports_2_logo.svg.png',
  id, 'Hindi', 'active', true, 2 FROM categories WHERE name = 'Sports' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Sports 1 Hindi', 'http://103.72.101.252:8080/live/34.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Star_Sports_1_logo.svg/320px-Star_Sports_1_logo.svg.png',
  id, 'Hindi', 'active', true, 3 FROM categories WHERE name = 'Sports' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Sports Select 1', 'http://103.72.101.252:8080/live/1427.m3u8',
  'https://i.imgur.com/rHidqGS.png',
  id, 'English', 'active', false, 4 FROM categories WHERE name = 'Sports' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Sony LIV Sports', 'http://103.72.101.252:8080/live/1394.m3u8',
  'https://i.imgur.com/hZXjxsJ.png',
  id, 'English', 'active', false, 5 FROM categories WHERE name = 'Sports' LIMIT 1;

-- MUSIC
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '9XM', 'https://9xjio.wiseplayout.com/9XM/master.m3u8',
  'https://i.imgur.com/uKpJMGG.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Music' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '9X Jalwa', 'https://b.jsrdn.com/strm/channels/9xjalwa/master.m3u8',
  'https://i.imgur.com/wRrqGvj.png',
  id, 'Hindi', 'active', false, 2 FROM categories WHERE name = 'Music' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '9X Jhakaas', 'https://9xjio.wiseplayout.com/9X_Jhakaas/master.m3u8',
  'https://i.imgur.com/OHWzO9I.png',
  id, 'Marathi', 'active', false, 3 FROM categories WHERE name = 'Music' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '9X Tashan', 'https://9xjio.wiseplayout.com/9X_Tashan/master.m3u8',
  'https://i.imgur.com/8EtV0yx.png',
  id, 'Punjabi', 'active', false, 4 FROM categories WHERE name = 'Music' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Balle Balle', 'https://mcncdndigital.com/balleballetv/index.m3u8',
  'https://i.imgur.com/aTFxELf.png',
  id, 'Punjabi', 'active', false, 5 FROM categories WHERE name = 'Music' LIMIT 1;

-- DEVOTIONAL
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha', 'https://aasthaott.akamaized.net/110923/smil:aasthatv.smil/index.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Bhajan', 'https://aasthaott.akamaized.net/110923/smil:bhajan.smil/playlist.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Hindi', 'active', false, 2 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Prime 1', 'https://aasthaott.akamaized.net/110923/smil:aasthaprime1.smil/master.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Hindi', 'active', false, 3 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Gujarati', 'https://aasthaott.akamaized.net/110923/smil:aasthagujrati.smil/playlist.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Gujarati', 'active', false, 4 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Tamil', 'https://aasthaott.akamaized.net/110923/smil:aasthatamil.smil/playlist.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Tamil', 'active', false, 5 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Telugu', 'https://aasthaott.akamaized.net/110923/smil:aasthatamil.smil/playlist.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Telugu', 'active', false, 6 FROM categories WHERE name = 'Devotional' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aastha Kannada', 'https://aasthaott.akamaized.net/110923/smil:aasthakannada.smil/playlist.m3u8',
  'https://i.imgur.com/z7DqMtx.png',
  id, 'Kannada', 'active', false, 7 FROM categories WHERE name = 'Devotional' LIMIT 1;

-- TAMIL
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Vijay', 'http://103.72.101.252:8080/live/57.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Star_Vijay_logo.svg/320px-Star_Vijay_logo.svg.png',
  id, 'Tamil', 'active', true, 1 FROM categories WHERE name = 'Tamil' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Sun TV', 'http://103.72.101.252:8080/live/56.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Sun_TV_logo.svg/320px-Sun_TV_logo.svg.png',
  id, 'Tamil', 'active', true, 2 FROM categories WHERE name = 'Tamil' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Tamil HD', 'http://103.72.101.252:8080/live/429.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Tamil', 'active', true, 3 FROM categories WHERE name = 'Tamil' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aaryaa TV', 'https://stream.ottlive.co.in/aryatvtamil/index.m3u8',
  'https://i.imgur.com/tHQBbSm.png',
  id, 'Tamil', 'active', false, 4 FROM categories WHERE name = 'Tamil' LIMIT 1;

-- TELUGU
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Star Maa', 'http://103.72.101.252:8080/live/75.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Star_Maa_logo.svg/320px-Star_Maa_logo.svg.png',
  id, 'Telugu', 'active', true, 1 FROM categories WHERE name = 'Telugu' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Zee Telugu', 'http://103.72.101.252:8080/live/76.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Zee_Telugu.svg/320px-Zee_Telugu.svg.png',
  id, 'Telugu', 'active', true, 2 FROM categories WHERE name = 'Telugu' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'ABN Andhra Jyoti', 'https://mumbai-edge.smartplaytv.in/ABNAJ/index.m3u8',
  'https://i.imgur.com/FDrqAY0.png',
  id, 'Telugu', 'active', false, 3 FROM categories WHERE name = 'Telugu' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '10 TV', 'https://mumbai-edge.smartplaytv.in/10TV/index.m3u8',
  'https://i.imgur.com/TwHjbhX.png',
  id, 'Telugu', 'active', false, 4 FROM categories WHERE name = 'Telugu' LIMIT 1;

-- MALAYALAM
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Asianet', 'https://anet.keralive.workers.dev/v1/master/a0d007312bfd99c47f76b77ae26b1ccdaae76cb1/starasianet1_live_https/index.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Asianet_logo.svg/320px-Asianet_logo.svg.png',
  id, 'Malayalam', 'active', true, 1 FROM categories WHERE name = 'Malayalam' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Asianet News', 'https://asianet-samsung.vgcdn.net/ptnr-monitoring/vglive-sk-906908/playlist.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Asianet_logo.svg/320px-Asianet_logo.svg.png',
  id, 'Malayalam', 'active', true, 2 FROM categories WHERE name = 'Malayalam' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Asianet Movies', 'https://anet.keralive.workers.dev/v1/master/a0d007312bfd99c47f76b77ae26b1ccdaae76cb1/asianetmovies_live_https/index.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Asianet_logo.svg/320px-Asianet_logo.svg.png',
  id, 'Malayalam', 'active', false, 3 FROM categories WHERE name = 'Malayalam' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Asianet Plus', 'https://anet.keralive.workers.dev/v1/master/a0d007312bfd99c47f76b77ae26b1ccdaae76cb1/asianetplus_live_https/index.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Asianet_logo.svg/320px-Asianet_logo.svg.png',
  id, 'Malayalam', 'active', false, 4 FROM categories WHERE name = 'Malayalam' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Amrita TV', 'https://ddash74r36xqp.cloudfront.net/master.m3u8',
  'https://i.imgur.com/Jg6QKVQ.png',
  id, 'Malayalam', 'active', false, 5 FROM categories WHERE name = 'Malayalam' LIMIT 1;

-- KANNADA
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Kannada', 'http://103.72.101.252:8080/live/1370.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Kannada', 'active', true, 1 FROM categories WHERE name = 'Kannada' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Kannada HD', 'http://103.72.101.252:8080/live/757.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Kannada', 'active', true, 2 FROM categories WHERE name = 'Kannada' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Kannada Cinema', 'http://103.72.101.252:8080/live/1632.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Kannada', 'active', false, 3 FROM categories WHERE name = 'Kannada' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Asianet Suvarna News', 'https://asianetnews.vgcdn.net/vglive-sk-335835/playlist.m3u8',
  'https://i.imgur.com/Jg6QKVQ.png',
  id, 'Kannada', 'active', false, 4 FROM categories WHERE name = 'Kannada' LIMIT 1;

-- BENGALI
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Bangla', 'http://103.72.101.252:8080/live/1369.m3u8',
  'https://i.imgur.com/9BEkNLF.png',
  id, 'Bengali', 'active', true, 1 FROM categories WHERE name = 'Bengali' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Bangla HD', 'http://103.72.101.252:8080/live/756.m3u8',
  'https://i.imgur.com/9BEkNLF.png',
  id, 'Bengali', 'active', true, 2 FROM categories WHERE name = 'Bengali' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'ABP Ananda', 'https://d2l4ar6y3mrs4k.cloudfront.net/live-streaming/ananda-livetv/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/ABP_News_Logo.png/320px-ABP_News_Logo.png',
  id, 'Bengali', 'active', true, 3 FROM categories WHERE name = 'Bengali' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Aamar Bangla', 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI/amarbanglatv.stream/playlist.m3u8',
  'https://i.imgur.com/9BEkNLF.png',
  id, 'Bengali', 'active', false, 4 FROM categories WHERE name = 'Bengali' LIMIT 1;

-- MARATHI
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Marathi', 'http://103.72.101.252:8080/live/1326.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Marathi', 'active', true, 1 FROM categories WHERE name = 'Marathi' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Marathi HD', 'http://103.72.101.252:8080/live/755.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Marathi', 'active', true, 2 FROM categories WHERE name = 'Marathi' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'ABP Majha', 'https://yupprestreamliveus.akamaized.net/vglive-sk-355289/majha/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/ABP_News_Logo.png/320px-ABP_News_Logo.png',
  id, 'Marathi', 'active', false, 3 FROM categories WHERE name = 'Marathi' LIMIT 1;

-- PUNJABI
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT '9X Tashan', 'https://9xjio.wiseplayout.com/9X_Tashan/master.m3u8',
  'https://i.imgur.com/8EtV0yx.png',
  id, 'Punjabi', 'active', true, 1 FROM categories WHERE name = 'Punjabi' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Chardikla Gurbaani TV', 'https://chardikalatimestv.gigabitcdn.net/in-chardikala/chardikala-gurbani-tv/playlist.m3u8',
  'https://i.imgur.com/b9S8Tgm.png',
  id, 'Punjabi', 'active', false, 2 FROM categories WHERE name = 'Punjabi' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Chardikla Time TV', 'https://chardikalagurbanitv.gigabitcdn.net/in-chardikala/chardikala-timetv/playlist.m3u8',
  'https://i.imgur.com/b9S8Tgm.png',
  id, 'Punjabi', 'active', false, 3 FROM categories WHERE name = 'Punjabi' LIMIT 1;

-- GUJARATI
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'Colors Gujarati', 'http://103.72.101.252:8080/live/196.m3u8',
  'https://i.imgur.com/pNGKPgM.png',
  id, 'Gujarati', 'active', true, 1 FROM categories WHERE name = 'Gujarati' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'ABP Asmita', 'https://d2l4ar6y3mrs4k.cloudfront.net/live-streaming/asmita-livetv/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/ABP_News_Logo.png/320px-ABP_News_Logo.png',
  id, 'Gujarati', 'active', false, 2 FROM categories WHERE name = 'Gujarati' LIMIT 1;

-- ENGLISH NEWS
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'CNBC TV18', 'https://n18syndication.akamaized.net/bpk-tv/CNBC_TV18_NW18_MOB/output01/index.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/CNBC_TV18_logo.svg/320px-CNBC_TV18_logo.svg.png',
  id, 'English', 'active', true, 1 FROM categories WHERE name = 'English News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'CNBC TV18 Prime HD', 'https://n18syndication.akamaized.net/bpk-tv/CNBC_Tv18_Prime_HD_NW18_MOB/output01/index.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/CNBC_TV18_logo.svg/320px-CNBC_TV18_logo.svg.png',
  id, 'English', 'active', false, 2 FROM categories WHERE name = 'English News' LIMIT 1;

-- BUSINESS NEWS
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'CNBC Awaaz', 'https://n18syndication.akamaized.net/bpk-tv/CNBC_Awaaz_NW18_MOB/output01/master.m3u8',
  'https://i.imgur.com/kKBJRD8.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Business News' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'CNBC Bajar', 'https://n18syndication.akamaized.net/bpk-tv/CNBC_Bazaar_NW18_MOB/output01/master.m3u8',
  'https://i.imgur.com/kKBJRD8.png',
  id, 'Hindi', 'active', false, 2 FROM categories WHERE name = 'Business News' LIMIT 1;

-- DOORDARSHAN
INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'DD National', 'http://103.213.31.109:90/DDNational/playlist.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DD_National.svg/320px-DD_National.svg.png',
  id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Doordarshan' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'DD India', 'http://103.213.31.109:90/DDIndia/playlist.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DD_National.svg/320px-DD_National.svg.png',
  id, 'Hindi', 'active', true, 2 FROM categories WHERE name = 'Doordarshan' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'DD Bharati', 'http://103.213.31.109:90/DDBharati/playlist.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DD_National.svg/320px-DD_National.svg.png',
  id, 'Hindi', 'active', false, 3 FROM categories WHERE name = 'Doordarshan' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'DD Bangla', 'https://cdn-4.pishow.tv/live/37/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DD_National.svg/320px-DD_National.svg.png',
  id, 'Bengali', 'active', false, 4 FROM categories WHERE name = 'Doordarshan' LIMIT 1;

INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
SELECT 'DD Chandana', 'https://cdn-3.pishow.tv/live/28/master.m3u8',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DD_National.svg/320px-DD_National.svg.png',
  id, 'Kannada', 'active', false, 5 FROM categories WHERE name = 'Doordarshan' LIMIT 1;

-- ============================================================
-- STEP 4: Update health_status for all channels
-- ============================================================
UPDATE channels SET health_status = 'unknown' WHERE health_status IS NULL;

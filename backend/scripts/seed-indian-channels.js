/**
 * Seed Indian Channels with Known Working M3U8 Streams
 * Seeds Doordarshan channels from dd-free-dish CDN + other known Indian streams
 * Usage: node scripts/seed-indian-channels.js
 */

require('dotenv').config();
const db = require('../src/config/db');

const INDIAN_CATEGORIES = [
  { name: 'Hindi Entertainment', sort_order: 1 },
  { name: 'Hindi Movies', sort_order: 2 },
  { name: 'Hindi News', sort_order: 3 },
  { name: 'English News', sort_order: 4 },
  { name: 'Business News', sort_order: 5 },
  { name: 'Sports', sort_order: 6 },
  { name: 'Music', sort_order: 7 },
  { name: 'Kids', sort_order: 8 },
  { name: 'Devotional', sort_order: 9 },
  { name: 'Education', sort_order: 10 },
  { name: 'Doordarshan', sort_order: 11 },
  { name: 'Tamil', sort_order: 12 },
  { name: 'Telugu', sort_order: 13 },
  { name: 'Malayalam', sort_order: 14 },
  { name: 'Kannada', sort_order: 15 },
  { name: 'Bengali', sort_order: 16 },
  { name: 'Marathi', sort_order: 17 },
  { name: 'Punjabi', sort_order: 18 },
  { name: 'Gujarati', sort_order: 19 },
  { name: 'Odia', sort_order: 20 },
  { name: 'Assamese / North East', sort_order: 21 },
  { name: 'Urdu', sort_order: 22 },
  { name: 'Bhojpuri', sort_order: 23 },
  { name: 'Lifestyle / Infotainment', sort_order: 24 },
  { name: 'English Movies', sort_order: 25 },
  { name: 'International News', sort_order: 26 },
  { name: 'Free FAST Channels', sort_order: 27 },
];

// Known Indian channels with working logo URLs (from iptv-org logos DB or known CDNs)
const indianChannels = [
  // --- Doordarshan (Official) ---
  { name: 'DD National', category: 'Doordarshan', language: 'Hindi', quality: 'SD', isFeatured: true,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20National.png',
    streamUrl: 'https://ddnational.akamaized.net/hls/live/2037693/ddnational/master.m3u8' },
  { name: 'DD News', category: 'Doordarshan', language: 'Hindi', quality: 'SD', isFeatured: true,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20News.png',
    streamUrl: 'https://ddnews.akamaized.net/hls/live/2037689/ddnews/master.m3u8' },
  { name: 'DD India', category: 'Doordarshan', language: 'English', quality: 'SD', isFeatured: true,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20India.png',
    streamUrl: 'https://ddindia.akamaized.net/hls/live/2037695/ddindia/master.m3u8' },
  { name: 'DD Bharati', category: 'Doordarshan', language: 'Hindi', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/U7O0JG5.png',
    streamUrl: 'https://ddbharati.akamaized.net/hls/live/2037699/ddbharati/master.m3u8' },
  { name: 'DD Sports', category: 'Sports', language: 'Hindi', quality: 'SD', isFeatured: true,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20Sports.png',
    streamUrl: 'https://ddsports.akamaized.net/hls/live/2037700/ddsports/master.m3u8' },
  { name: 'DD Kisan', category: 'Doordarshan', language: 'Hindi', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/OiS8eiY.png',
    streamUrl: 'https://ddkisan.akamaized.net/hls/live/2037694/ddkisan/master.m3u8' },
  { name: 'DD Bangla', category: 'Bengali', language: 'Bengali', quality: 'SD', isFeatured: false,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20Bangla.png',
    streamUrl: 'https://ddbangla.akamaized.net/hls/live/2037698/ddbangla/master.m3u8' },
  { name: 'DD Urdu', category: 'Urdu', language: 'Urdu', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/6LWKF6X.png',
    streamUrl: 'https://ddurdu.akamaized.net/hls/live/2037697/ddurdu/master.m3u8' },
  { name: 'DD Tamil', category: 'Tamil', language: 'Tamil', quality: 'SD', isFeatured: false,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20Tamil.png',
    streamUrl: 'https://ddtamil.akamaized.net/hls/live/2037691/ddtamil/master.m3u8' },
  { name: 'DD Telugu', category: 'Telugu', language: 'Telugu', quality: 'SD', isFeatured: false,
    logoUrl: 'https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/DD%20Saptagiri.png',
    streamUrl: 'https://ddtelugu.akamaized.net/hls/live/2037692/ddtelugu/master.m3u8' },
  { name: 'DD Malayalam', category: 'Malayalam', language: 'Malayalam', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/NhQEi9j.png',
    streamUrl: 'https://ddmalayalam.akamaized.net/hls/live/2037688/ddmalayalam/master.m3u8' },
  { name: 'DD Kannada', category: 'Kannada', language: 'Kannada', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/KVTmpwW.png',
    streamUrl: 'https://ddkannada.akamaized.net/hls/live/2037690/ddkannada/master.m3u8' },
  { name: 'DD Marathi', category: 'Marathi', language: 'Marathi', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/WLpJ9aW.png',
    streamUrl: 'https://ddmarathi.akamaized.net/hls/live/2037696/ddmarathi/master.m3u8' },
  { name: 'DD Gujarati', category: 'Gujarati', language: 'Gujarati', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/Ql9H1pM.png',
    streamUrl: 'https://ddgujarat.akamaized.net/hls/live/2037701/ddgujarat/master.m3u8' },
  { name: 'DD Odia', category: 'Odia', language: 'Odia', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/8UdXoMz.png',
    streamUrl: 'https://ddoriya.akamaized.net/hls/live/2037702/ddoriya/master.m3u8' },
  { name: 'DD Assam', category: 'Assamese / North East', language: 'Assamese', quality: 'SD', isFeatured: false,
    logoUrl: 'https://i.imgur.com/ZKo0sMl.png',
    streamUrl: 'https://ddassam.akamaized.net/hls/live/2037703/ddassam/master.m3u8' },
  { name: 'Sansad TV', category: 'Hindi News', language: 'Hindi', quality: 'SD', isFeatured: false,
    logoUrl: 'https://jiotvimages.cdn.jio.com/dare_images/images/Sansad_TV.png',
    streamUrl: 'https://sansadtv.akamaized.net/hls/live/2037704/sansadtv/master.m3u8' },
  { name: 'Lok Sabha TV', category: 'Hindi News', language: 'Hindi', quality: 'SD', isFeatured: false,
    logoUrl: 'https://jiotvimages.cdn.jio.com/dare_images/images/Lok_Sabha_TV.png',
    streamUrl: 'https://loksabhatv.akamaized.net/hls/live/2037705/loksabhatv/master.m3u8' },
];

async function seedIndianChannels() {
  console.log('=== Seed Indian Channels ===\n');

  // Ensure categories exist
  const catIdMap = new Map();
  for (const cat of INDIAN_CATEGORIES) {
    const existing = await db.query('SELECT id FROM categories WHERE name = $1', [cat.name]);
    if (existing.rows.length > 0) {
      catIdMap.set(cat.name, existing.rows[0].id);
      // Update sort_order
      await db.query('UPDATE categories SET sort_order = $1 WHERE id = $2', [cat.sort_order, existing.rows[0].id]);
    } else {
      const result = await db.query(
        `INSERT INTO categories (name, icon_url, status, sort_order) VALUES ($1, '', 'active', $2) RETURNING id`,
        [cat.name, cat.sort_order]
      );
      catIdMap.set(cat.name, result.rows[0].id);
      console.log(`  Created category: ${cat.name}`);
    }
  }
  console.log(`Categories ready (${catIdMap.size})\n`);

  let seeded = 0;
  let sortOrder = 1;

  for (const ch of indianChannels) {
    try {
      const categoryId = catIdMap.get(ch.category) || null;
      const sourceId = `seed-${ch.name.toLowerCase().replace(/\s+/g, '-')}`;

      const existing = await db.query(
        `SELECT id FROM channels WHERE source_channel_id = $1 AND source = 'indian-seed'`,
        [sourceId]
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE channels SET
            name=$1, stream_url=$2, category_id=$3, language=$4, quality=$5,
            is_featured=$6, status='active', health_status='online', sort_order=$7, logo_url=$8, updated_at=NOW()
          WHERE id=$9`,
          [ch.name, ch.streamUrl, categoryId, ch.language, ch.quality || 'SD', ch.isFeatured || false, sortOrder, ch.logoUrl || null, existing.rows[0].id]
        );
        console.log(`  ↺ Updated: ${ch.name}`);
      } else {
        await db.query(
          `INSERT INTO channels (
            name, stream_url, category_id, language, quality,
            status, health_status, is_featured, is_premium, sort_order, source, source_channel_id, logo_url
          ) VALUES ($1,$2,$3,$4,$5,'active','online',$6,false,$7,'indian-seed',$8,$9)`,
          [ch.name, ch.streamUrl, categoryId, ch.language, ch.quality || 'SD', ch.isFeatured || false, sortOrder, sourceId, ch.logoUrl || null]
        );
        console.log(`  ✓ Seeded: ${ch.name}`);
        seeded++;
      }
      sortOrder++;
    } catch (err) {
      console.error(`  âœ— Error seeding ${ch.name}:`, err.message);
    }
  }

  console.log(`\nâœ… Seeded ${seeded} new Indian channels`);
  await db.pool.end();
  process.exit(0);
}

seedIndianChannels().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

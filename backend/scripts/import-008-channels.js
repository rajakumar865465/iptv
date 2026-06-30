require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function import008() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '008_update_channel_streams.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Regex to match the INSERT statements
  // Example: SELECT 'Star Plus', 'http://...', 'https://...', id, 'Hindi', 'active', true, 1 FROM categories WHERE name = 'Hindi Entertainment' LIMIT 1;
  const regex = /SELECT '([^']+)', '([^']+)',\s*'([^']*)',\s*id, '([^']+)', '([^']+)', (true|false), (\d+) FROM categories WHERE name = '([^']+)'/g;

  let match;
  let added = 0;
  let streamsAdded = 0;

  console.log('--- Starting Import of 008 Channels ---');

  while ((match = regex.exec(sqlContent)) !== null) {
    const name = match[1];
    const streamUrl = match[2];
    const logoUrl = match[3];
    const language = match[4];
    const status = match[5];
    const isFeatured = match[6] === 'true';
    const sortOrder = parseInt(match[7], 10);
    const categoryName = match[8];

    // Get category id
    const catRes = await db.query('SELECT id FROM categories WHERE name = $1 LIMIT 1', [categoryName]);
    if (catRes.rows.length === 0) {
      console.warn(`Category not found: ${categoryName} for channel ${name}`);
      continue;
    }
    const categoryId = catRes.rows[0].id;

    // Check if channel already exists
    const existing = await db.query('SELECT id, stream_url FROM channels WHERE name = $1 LIMIT 1', [name]);

    if (existing.rows.length > 0) {
      const channelId = existing.rows[0].id;
      // Add stream if not exists
      const streamCheck = await db.query('SELECT id FROM channel_streams WHERE channel_id = $1 AND stream_url = $2', [channelId, streamUrl]);
      if (streamCheck.rows.length === 0) {
        await db.query(`
          INSERT INTO channel_streams (channel_id, stream_url, resolution, status, is_backup)
          VALUES ($1, $2, 'SD', 'active', false)
        `, [channelId, streamUrl]);
        streamsAdded++;
        console.log(`[MERGE] Added premium stream to existing channel: ${name}`);
      }
    } else {
      // Insert new channel
      const insertRes = await db.query(`
        INSERT INTO channels (name, stream_url, logo_url, category_id, language, status, is_featured, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [name, streamUrl, logoUrl, categoryId, language, status, isFeatured, sortOrder]);
      const newId = insertRes.rows[0].id;
      
      // Also add to channel_streams
      await db.query(`
        INSERT INTO channel_streams (channel_id, stream_url, resolution, status, is_backup)
        VALUES ($1, $2, 'SD', 'active', false)
      `, [newId, streamUrl]);
      
      added++;
      console.log(`[NEW] Inserted new premium channel: ${name}`);
    }
  }

  console.log('--- Import Complete ---');
  console.log(`New Channels Added: ${added}`);
  console.log(`Premium Streams Merged: ${streamsAdded}`);
  process.exit(0);
}

import008().catch(err => {
  console.error(err);
  process.exit(1);
});

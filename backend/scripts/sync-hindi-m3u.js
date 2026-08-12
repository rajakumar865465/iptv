require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const https = require('https');

const M3U_URL = 'https://iptv-org.github.io/iptv/languages/hin.m3u';

async function fetchM3u(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function syncHindiM3u() {
  console.log(`[hindi-m3u-sync] Fetching M3U from ${M3U_URL}...`);
  try {
    const content = await fetchM3u(M3U_URL);
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);

    let addedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXTINF:')) {
        // e.g. #EXTINF:-1 tvg-id="123" group-title="Entertainment", Channel Name
        let namePart = line.split(',')[1];
        if (!namePart) continue;

        let rawName = namePart.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();

        let url = null;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('http')) {
            url = lines[j];
            break;
          } else if (lines[j].startsWith('#EXTINF:')) {
            break;
          }
        }

        if (!url) continue;

        // Ensure channel exists in the main channels table
        let result = await db.query('SELECT id FROM channels WHERE name = $1', [rawName]);
        let channelId;

        if (result.rows.length === 0) {
          // Try ILIKE just in case
          result = await db.query('SELECT id FROM channels WHERE name ILIKE $1', [rawName]);
        }

        if (result.rows.length > 0) {
          channelId = result.rows[0].id;
          // Unhide it if hidden
          await db.query(`UPDATE channels SET is_visible_app = true, status = 'active', health_status = 'online' WHERE id = $1`, [channelId]);
        } else {
          // Create the channel if it doesn't exist at all
          const insertRes = await db.query(`
            INSERT INTO channels (name, stream_url, country, language, is_visible_app, status, health_status) 
            VALUES ($1, $2, 'IN', 'Hindi', true, 'active', 'online') RETURNING id
          `, [rawName, url]);
          channelId = insertRes.rows[0].id;
        }

        // Check if stream already exists
        const streamResult = await db.query('SELECT id FROM channel_streams WHERE stream_url = $1 AND channel_id = $2', [url, channelId]);
        
        if (streamResult.rows.length === 0) {
          // Insert the new stream as verified online with high priority
          await db.query(`
            INSERT INTO channel_streams (channel_id, stream_url, quality, health_status, health_score, priority)
            VALUES ($1, $2, 'auto', 'online', 100, 1)
          `, [channelId, url]);
          addedCount++;
        } else {
          // Update existing stream to online
          await db.query(`
            UPDATE channel_streams SET health_status = 'online', health_score = 100, priority = 1
            WHERE id = $1
          `, [streamResult.rows[0].id]);
          updatedCount++;
        }
      }
    }

    console.log(`[hindi-m3u-sync] Successfully added ${addedCount} new streams and updated ${updatedCount} existing streams.`);
    
    // Refresh the channels table pointers
    const { rowCount: activated } = await db.query(`
      UPDATE channels SET
        status        = 'active',
        health_status = 'online',
        active_stream_id = sub.best_stream_id,
        stream_url    = sub.best_url,
        updated_at    = NOW()
      FROM (
        SELECT DISTINCT ON (channel_id)
          channel_id, id AS best_stream_id, stream_url AS best_url
        FROM channel_streams
        WHERE health_status = 'online'
        ORDER BY channel_id, priority ASC, health_score DESC
      ) sub
      WHERE channels.id = sub.channel_id
    `);
    console.log(`[hindi-m3u-sync] Refreshed ${activated} active channels in the main table.`);

    // Assign permanent channel numbers to any newly added channels.
    try {
      const { assignChannelNumbers } = require('../src/utils/channelNumbering');
      const { assigned } = await assignChannelNumbers(db);
      console.log(`[hindi-m3u-sync] Channel numbers assigned: ${assigned}`);
    } catch (e) {
      console.error('[hindi-m3u-sync] Channel number assignment failed:', e.message);
    }
  } catch (err) {
    console.error('[hindi-m3u-sync] Error during sync:', err.message);
  } finally {
    await db.pool.end();
  }
}

// Allow importing for cron, or running directly
if (require.main === module) {
  syncHindiM3u().catch(console.error);
}

module.exports = { syncHindiM3u };

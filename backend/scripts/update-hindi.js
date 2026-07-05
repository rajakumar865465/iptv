require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const https = require('https');

function fetchM3u(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching hin.m3u...');
  const content = await fetchM3u('https://iptv-org.github.io/iptv/languages/hin.m3u');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let updatedCount = 0;
  let addedStreams = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
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

      // Find matching channel in DB. 
      // We only target Hindi channels to avoid false positives (e.g., if another language has a channel with the same name).
      let result = await db.query(
        'SELECT id FROM channels WHERE name ILIKE $1 AND (language ILIKE $2 OR language IS NULL)', 
        [rawName, '%hindi%']
      );
      if (result.rows.length === 0) {
        result = await db.query(
          'SELECT id FROM channels WHERE name ILIKE $1 AND (language ILIKE $2 OR language IS NULL)', 
          [`%${rawName}%`, '%hindi%']
        );
      }

      if (result.rows.length > 0) {
        const channelId = result.rows[0].id;
        
        // Check if stream already exists
        const streamResult = await db.query('SELECT id FROM channel_streams WHERE stream_url = $1 AND channel_id = $2', [url, channelId]);
        
        if (streamResult.rows.length === 0) {
          // Insert the new stream as highest priority
          await db.query(`
            INSERT INTO channel_streams (channel_id, stream_url, quality, priority, health_status, health_score, is_hidden)
            VALUES ($1, $2, 'auto', 1, 'unknown', 50, false)
          `, [channelId, url]);
          addedStreams++;
          console.log(`[+] Added new Hindi stream for: ${rawName}`);
        } else {
          // Boost priority of existing stream
          await db.query(`
            UPDATE channel_streams SET priority = 1, is_hidden = false
            WHERE id = $1
          `, [streamResult.rows[0].id]);
        }
        updatedCount++;
      }
    }
  }

  console.log(`\nProcessed ${updatedCount} Hindi channels. Added ${addedStreams} new streams.`);

  // Hide all not working channels across the database (or just Hindi ones? The user said "hide all not working channals").
  console.log('\nHiding all offline channels (as requested)...');
  const hideResult = await db.query(`
    UPDATE channels 
    SET is_hidden = true 
    WHERE health_status = 'offline' OR stream_url IS NULL OR stream_url = ''
  `);
  console.log(`Auto-hid ${hideResult.rowCount} broken or offline channels.`);

  // Update the channels table active stream to point to the new working streams
  console.log('\nRefreshing active streams for working channels...');
  const { rowCount: activated } = await db.query(`
    UPDATE channels SET
      is_hidden     = false,
      status        = 'active',
      active_stream_id = sub.best_stream_id,
      stream_url    = sub.best_url,
      updated_at    = NOW()
    FROM (
      SELECT DISTINCT ON (channel_id)
        channel_id, id AS best_stream_id, stream_url AS best_url
      FROM channel_streams
      WHERE health_status IN ('online', 'unstable', 'unknown') AND is_hidden IS NOT TRUE
      ORDER BY channel_id, priority ASC, health_score DESC
    ) sub
    WHERE channels.id = sub.channel_id AND channels.health_status != 'offline'
  `);
  console.log(`Refreshed ${activated} active channels with new streams.`);

  await db.pool.end();
}

main().catch(console.error);

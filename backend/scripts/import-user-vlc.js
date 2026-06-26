require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const fs = require('fs');

async function main() {
  const content = fs.readFileSync(__dirname + '/../updated_channels_2.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let updatedCount = 0;
  let notFound = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains the separator " | "
    if (line.includes(' | http')) {
      const parts = line.split(' | ');
      if (parts.length < 2) continue;

      const namePart = parts[0].trim();
      const url = parts[1].trim();

      // Clean up the name (remove (1080p), [Geo-blocked], etc.)
      let rawName = namePart.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();

      if (!url) continue;

      // Find channel in DB
      let result = await db.query('SELECT id FROM channels WHERE name ILIKE $1', [rawName]);
      if (result.rows.length === 0) {
        result = await db.query('SELECT id FROM channels WHERE name ILIKE $1', [`%${rawName}%`]);
      }

      if (result.rows.length > 0) {
        // Just take the first match
        const channelId = result.rows[0].id;
        
        // Check if stream already exists
        const streamResult = await db.query('SELECT id FROM channel_streams WHERE stream_url = $1 AND channel_id = $2', [url, channelId]);
        
        if (streamResult.rows.length === 0) {
          // Insert the new stream as verified online with high priority (1 is highest)
          await db.query(`
            INSERT INTO channel_streams (channel_id, stream_url, quality, health_status, health_score, priority)
            VALUES ($1, $2, 'auto', 'online', 100, 1)
          `, [channelId, url]);
          console.log(`[+] Added new stream for: ${rawName}`);
        } else {
          // Update existing stream to online
          await db.query(`
            UPDATE channel_streams SET health_status = 'online', health_score = 100, priority = 1
            WHERE id = $1
          `, [streamResult.rows[0].id]);
          console.log(`[~] Updated existing stream for: ${rawName}`);
        }
        updatedCount++;
      } else {
        notFound.push(rawName);
      }
    }
  }

  console.log(`\nSuccessfully updated streams for ${updatedCount} channels.`);
  if (notFound.length > 0) {
    console.log(`Could not find ${notFound.length} channels in the database. Examples: ${notFound.slice(0, 5).join(', ')}`);
  }
  
  // Now run the activate-working-channels query to ensure the channels table is refreshed
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
  console.log(`Refreshed ${activated} active channels in the main table.`);

  await db.pool.end();
}

main().catch(console.error);

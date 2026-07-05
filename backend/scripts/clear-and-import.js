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
  console.log('--- WARNING: CLEARING ENTIRE CHANNELS DATABASE ---');
  
  await db.query('DELETE FROM channel_streams');
  await db.query('DELETE FROM channels');
  // Attempt to reset sequence if it exists
  try {
    await db.query('ALTER SEQUENCE channels_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE channel_streams_id_seq RESTART WITH 1');
  } catch (e) {
    // Ignore if sequence doesn't exist or syntax differs
  }
  
  console.log('Database cleared.');
  console.log('Fetching new channels from hin.m3u...');

  const content = await fetchM3u('https://iptv-org.github.io/iptv/languages/hin.m3u');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let insertedChannels = 0;
  
  // A simple map to handle duplicate channel names in the M3U (append stream to existing)
  const channelMap = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      let namePart = line.split(',')[1];
      if (!namePart) continue;

      let rawName = namePart.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();
      let logo = line.match(/tvg-logo="([^"]*)"/) ?. [1] || null;

      let url = null;
      let userAgent = null;
      let referer = null;
      for (let j = i + 1; j < lines.length; j++) {
        const lj = lines[j];
        if (lj.startsWith('http')) {
          url = lj;
          break;
        } else if (lj.startsWith('#EXTINF:')) {
          break;
        } else if (lj.startsWith('#EXTVLCOPT:http-user-agent=')) {
          userAgent = lj.substring('#EXTVLCOPT:http-user-agent='.length).trim();
        } else if (lj.startsWith('#EXTVLCOPT:http-referrer=')) {
          referer = lj.substring('#EXTVLCOPT:http-referrer='.length).trim();
        } else if (lj.startsWith('#EXTHTTP:')) {
          try {
            const hdrs = JSON.parse(lj.substring('#EXTHTTP:'.length));
            if (hdrs['User-Agent']) userAgent = hdrs['User-Agent'];
            if (hdrs['Referer']) referer = hdrs['Referer'];
          } catch(e) {}
        }
      }

      if (!url) continue;

      if (!channelMap.has(rawName)) {
        channelMap.set(rawName, { name: rawName, logo, streams: [{ url, userAgent, referer }] });
      } else {
        channelMap.get(rawName).streams.push({ url, userAgent, referer });
      }
    }
  }
  
  console.log(`Found ${channelMap.size} unique channels to import.`);

  // Find a default category to attach these to, or fallback to NULL
  let defaultCategoryId = null;
  const catRes = await db.query('SELECT id FROM categories LIMIT 1');
  if (catRes.rows.length > 0) {
    defaultCategoryId = catRes.rows[0].id;
  }

  // Insert them
  for (const [name, data] of channelMap.entries()) {
    try {
      // 1. Insert channel with the first stream as its active stream
      const cRes = await db.query(`
        INSERT INTO channels (name, logo_url, category_id, language, is_premium, is_hidden, is_visible_app, status, health_status, stream_url)
        VALUES ($1, $2, $3, 'Hindi', false, false, true, 'active', 'unknown', $4)
        RETURNING id
      `, [data.name, data.logo, defaultCategoryId, data.streams[0]]);
      
      const channelId = cRes.rows[0].id;

      // 2. Insert streams
      for (let i = 0; i < data.streams.length; i++) {
        const { url, userAgent, referer } = data.streams[i];
        await db.query(`
          INSERT INTO channel_streams (channel_id, stream_url, user_agent, referer, quality, priority, health_status, health_score)
          VALUES ($1, $2, $3, $4, 'auto', $5, 'unknown', 50)
        `, [channelId, url, userAgent, referer, i + 1]);
      }
      
      insertedChannels++;
    } catch (err) {
      console.error(`Failed to insert ${name}:`, err.message);
    }
  }

  // Set first stream as active stream url
  await db.query(`
    UPDATE channels SET
      active_stream_id = sub.id,
      stream_url = sub.stream_url
    FROM (
      SELECT DISTINCT ON (channel_id) channel_id, id, stream_url
      FROM channel_streams
      ORDER BY channel_id, priority ASC
    ) sub
    WHERE channels.id = sub.channel_id
  `);

  console.log(`\nSuccess! Completely wiped database and imported ${insertedChannels} fresh, free Hindi channels.`);
  await db.pool.end();
}

main().catch(console.error);

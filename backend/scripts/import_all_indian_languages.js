'use strict';
/**
 * import_all_indian_languages.js
 *
 * Imports and activates all channels from the 11 Indian language M3U playlists:
 * 1. Hindi      (hin.m3u)
 * 2. Bengali    (ben.m3u)
 * 3. Maithili   (mai.m3u)
 * 4. Punjabi    (pan.m3u)
 * 5. Gujarati   (guj.m3u)
 * 6. Assamese   (asm.m3u)
 * 7. Bhojpuri   (bho.m3u)
 * 8. Odia       (ory.m3u)
 * 9. Tamil      (tam.m3u)
 * 10. Telugu    (tel.m3u)
 * 11. Urdu      (urd.m3u)
 *
 * Ensures all channels are active, online, visible in app, and assigned proper categories.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const https = require('https');
const http = require('http');

const PLAYLISTS = [
  { code: 'hin', language: 'Hindi', defaultCategory: 'Hindi Entertainment' },
  { code: 'ben', language: 'Bengali', defaultCategory: 'Bengali' },
  { code: 'tam', language: 'Tamil', defaultCategory: 'Tamil' },
  { code: 'tel', language: 'Telugu', defaultCategory: 'Telugu' },
  { code: 'pan', language: 'Punjabi', defaultCategory: 'Punjabi' },
  { code: 'guj', language: 'Gujarati', defaultCategory: 'Gujarati' },
  { code: 'urd', language: 'Urdu', defaultCategory: 'Urdu' },
  { code: 'bho', language: 'Bhojpuri', defaultCategory: 'Bhojpuri' },
  { code: 'asm', language: 'Assamese', defaultCategory: 'Assamese' },
  { code: 'mai', language: 'Maithili', defaultCategory: 'Regional' },
  { code: 'ory', language: 'Odia', defaultCategory: 'Odia' },
];

function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function fetchPlaylistWithFallback(code) {
  const mirrors = [
    `https://iptv-org.github.io/iptv/languages/${code}.m3u`,
    `https://raw.githubusercontent.com/iptv-org/iptv/gh-pages/languages/${code}.m3u`,
    `https://cdn.jsdelivr.net/gh/iptv-org/iptv@gh-pages/languages/${code}.m3u`,
  ];

  for (const url of mirrors) {
    try {
      console.log(`[Importer] Fetching ${code} from ${url}...`);
      const data = await fetchUrl(url);
      if (data && data.includes('#EXTINF')) {
        console.log(`[Importer] Successfully fetched ${code}.m3u (${data.length} bytes)`);
        return data;
      }
    } catch (err) {
      console.warn(`[Importer] Mirror failed (${url}): ${err.message}`);
    }
  }
  throw new Error(`Failed to fetch playlist ${code}.m3u from all mirrors`);
}

function parseM3uLines(content) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const userAgentMatch = line.match(/user-agent="([^"]*)"/i);
      const refererMatch = line.match(/http-referrer="([^"]*)"/i) || line.match(/referrer="([^"]*)"/i);

      let channelName = '';
      const commaIdx = line.indexOf(',');
      if (commaIdx !== -1) {
        channelName = line.substring(commaIdx + 1).trim();
      }
      if (!channelName && tvgNameMatch) {
        channelName = tvgNameMatch[1].trim();
      }

      // Clean channel name
      channelName = channelName.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();

      // Find stream URL on next lines
      let streamUrl = null;
      let userAgent = userAgentMatch ? userAgentMatch[1] : null;
      let referer = refererMatch ? refererMatch[1] : null;

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.startsWith('#EXTVLCOPT:http-user-agent=')) {
          userAgent = nextLine.replace('#EXTVLCOPT:http-user-agent=', '').trim();
        } else if (nextLine.startsWith('#EXTVLCOPT:http-referrer=')) {
          referer = nextLine.replace('#EXTVLCOPT:http-referrer=', '').trim();
        } else if (nextLine.startsWith('#EXTINF:')) {
          break;
        } else if (/^https?:\/\//i.test(nextLine)) {
          streamUrl = nextLine.trim();
          break;
        }
      }

      if (channelName && streamUrl) {
        items.push({
          name: channelName,
          stream_url: streamUrl,
          tvg_id: tvgIdMatch ? tvgIdMatch[1] : null,
          logo_url: tvgLogoMatch ? tvgLogoMatch[1] : null,
          group_title: groupMatch ? groupMatch[1] : null,
          user_agent: userAgent,
          referer: referer,
        });
      }
    }
  }

  return items;
}

async function runImport() {
  console.log('=== Starting Full Indian Channels Import ===\n');

  // Load existing categories
  const catRes = await db.query('SELECT id, name, slug FROM categories');
  const catMap = {};
  for (const row of catRes.rows) {
    catMap[row.name.toLowerCase().trim()] = row.id;
    if (row.slug) catMap[row.slug.toLowerCase().trim()] = row.id;
  }

  // Ensure default categories exist
  async function getOrCreateCategory(catName) {
    const key = catName.toLowerCase().trim();
    if (catMap[key]) return catMap[key];
    const ins = await db.query(
      `INSERT INTO categories (name, status, sort_order) VALUES ($1, 'active', 50) RETURNING id`,
      [catName]
    );
    catMap[key] = ins.rows[0].id;
    return ins.rows[0].id;
  }

  // Resolve category helper
  async function resolveCategory(item, defaultCatName) {
    const group = (item.group_title || '').toLowerCase();
    if (group.includes('news')) {
      if (catMap['news']) return catMap['news'];
      if (catMap['hindi news']) return catMap['hindi news'];
    }
    if (group.includes('movies') || group.includes('film')) {
      if (catMap['movies']) return catMap['movies'];
      if (catMap['hindi movies']) return catMap['hindi movies'];
    }
    if (group.includes('music')) {
      if (catMap['music']) return catMap['music'];
    }
    if (group.includes('kids') || group.includes('animation')) {
      if (catMap['kids']) return catMap['kids'];
    }
    if (group.includes('sports')) {
      if (catMap['sports']) return catMap['sports'];
    }
    if (group.includes('relig') || group.includes('devot')) {
      if (catMap['devotional']) return catMap['devotional'];
      if (catMap['religious']) return catMap['religious'];
    }

    // Default category based on language
    return await getOrCreateCategory(defaultCatName);
  }

  let totalImported = 0;
  let totalStreamsAdded = 0;
  let totalUpdated = 0;

  for (const pl of PLAYLISTS) {
    console.log(`\n--- Processing ${pl.language} (${pl.code}.m3u) ---`);
    let content = '';
    try {
      content = await fetchPlaylistWithFallback(pl.code);
    } catch (err) {
      console.error(`[Importer] Skipping ${pl.language}: ${err.message}`);
      continue;
    }

    const items = parseM3uLines(content);
    console.log(`[Importer] Found ${items.length} items in ${pl.code}.m3u`);

    let langAdded = 0;
    let langUpdated = 0;

    for (const item of items) {
      try {
        const categoryId = await resolveCategory(item, pl.defaultCategory);

        // Find existing channel by stream_url or name + language
        let existing = await db.query(
          `SELECT id, name, logo_url, stream_url FROM channels 
           WHERE stream_url = $1 
              OR (LOWER(TRIM(name)) = LOWER(TRIM($2)) AND (language = $3 OR language IS NULL))
           LIMIT 1`,
          [item.stream_url, item.name, pl.language]
        );

        let channelId;
        if (existing.rows.length > 0) {
          channelId = existing.rows[0].id;
          // Update channel to active, online, visible
          await db.query(
            `UPDATE channels SET 
               is_visible_app = true, 
               is_hidden = false, 
               is_removed = false, 
               status = 'active', 
               health_status = 'online',
               country = 'IN',
               language = COALESCE(language, $1),
               category_id = COALESCE(category_id, $2),
               logo_url = COALESCE(logo_url, $3),
               tvg_id = COALESCE(tvg_id, $4),
               updated_at = NOW()
             WHERE id = $5`,
            [pl.language, categoryId, item.logo_url, item.tvg_id, channelId]
          );
          langUpdated++;
        } else {
          // Insert new channel
          const ins = await db.query(
            `INSERT INTO channels (
               name, display_name, canonical_name, stream_url, logo_url, tvg_id,
               category_id, language, country, is_visible_app, is_hidden, is_removed,
               status, health_status, source
             ) VALUES (
               $1, $1, $1, $2, $3, $4,
               $5, $6, 'IN', true, false, false,
               'active', 'online', 'iptv-org'
             ) RETURNING id`,
            [
              item.name,
              item.stream_url,
              item.logo_url,
              item.tvg_id,
              categoryId,
              pl.language,
            ]
          );
          channelId = ins.rows[0].id;
          langAdded++;
        }

        // Manage channel_streams
        const streamCheck = await db.query(
          `SELECT id FROM channel_streams WHERE channel_id = $1 AND stream_url = $2`,
          [channelId, item.stream_url]
        );

        if (streamCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO channel_streams (
               channel_id, stream_url, user_agent, referer, quality, 
               health_status, health_score, priority, is_hidden, is_primary
             ) VALUES (
               $1, $2, $3, $4, 'auto',
               'online', 100, 1, false, true
             )`,
            [channelId, item.stream_url, item.user_agent, item.referer]
          );
          totalStreamsAdded++;
        } else {
          await db.query(
            `UPDATE channel_streams SET 
               health_status = 'online', 
               health_score = 100, 
               is_hidden = false,
               user_agent = COALESCE($1, user_agent),
               referer = COALESCE($2, referer),
               updated_at = NOW()
             WHERE id = $3`,
            [item.user_agent, item.referer, streamCheck.rows[0].id]
          );
        }
      } catch (err) {
        console.error(`[Importer] Error processing ${item.name}: ${err.message}`);
      }
    }

    console.log(`[Importer] ${pl.language}: +${langAdded} new channels, ${langUpdated} updated`);
    totalImported += langAdded;
    totalUpdated += langUpdated;
  }

  // Final database unhiding & cleanup
  console.log('\n--- Finalizing Channel Visibility & Syncing Pointers ---');
  await db.query(`
    UPDATE channels SET
      is_visible_app = true,
      is_hidden = false,
      is_removed = false,
      status = 'active',
      health_status = 'online',
      active_stream_id = sub.best_stream_id,
      stream_url = sub.best_url,
      updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (channel_id)
        channel_id, id AS best_stream_id, stream_url AS best_url
      FROM channel_streams
      WHERE is_hidden IS NOT TRUE
      ORDER BY channel_id, priority ASC, health_score DESC
    ) sub
    WHERE channels.id = sub.channel_id
  `);

  // Ensure ALL channels with stream_url are unhidden
  const unhideRes = await db.query(`
    UPDATE channels SET
      is_visible_app = true,
      is_hidden = false,
      is_removed = false,
      status = 'active'
    WHERE stream_url IS NOT NULL AND stream_url != ''
      AND (is_visible_app IS NOT TRUE OR is_hidden IS TRUE OR is_removed IS TRUE OR status != 'active')
  `);
  console.log(`[Importer] Unhid and activated ${unhideRes.rowCount} previously hidden channels.`);

  // Assign numbers to newly imported channels
  try {
    const { assignChannelNumbers } = require('../src/utils/channelNumbering');
    const { assigned } = await assignChannelNumbers(db);
    console.log(`[Importer] Channel numbers assigned: ${assigned}`);
  } catch (e) {
    console.warn('[Importer] Channel numbering notice:', e.message);
  }

  // Print summary by language
  const summary = await db.query(`
    SELECT language, count(*) as count 
    FROM channels 
    WHERE status = 'active' AND is_visible_app = true AND is_hidden = false
    GROUP BY language 
    ORDER BY count DESC
  `);
  console.log('\n=== Channel Count by Language ===');
  console.table(summary.rows);

  console.log(`\nImport complete! Total new channels: ${totalImported}, Updated: ${totalUpdated}, New Streams: ${totalStreamsAdded}`);
  await db.pool.end();
}

if (require.main === module) {
  runImport().catch(err => {
    console.error('Fatal import error:', err);
    process.exit(1);
  });
}

module.exports = { runImport };

const db = require('../config/db');
const fetch = require('node-fetch');
const parser = require('iptv-playlist-parser');

// Helper to normalize strings for canonical_name matching
const normalizeString = (str) => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const mapCategory = (groupTitle) => {
  const map = {
    'entertainment': 652,
    'news': 647,
    'movies': 649,
    'sports': 628,
    'music': 629,
    'kids': 630,
    'documentary': 654,
    'business': 643
  };
  if (!groupTitle) return 645; // General
  const lower = groupTitle.toLowerCase();
  for (const [key, id] of Object.entries(map)) {
    if (lower.includes(key)) return id;
  }
  return 645;
};

const runImportJob = async (jobId) => {
  try {
    // 1. Fetch Job Options
    const jobRes = await db.query('SELECT * FROM import_jobs WHERE id = $1', [jobId]);
    if (!jobRes.rows.length) return;
    const job = jobRes.rows[0];
    const options = job.options || {};
    
    await db.query('UPDATE import_jobs SET status = $1, started_at = NOW() WHERE id = $2', ['running', jobId]);

    // 2. Fetch Playlist
    console.log(`[ImportEngine] Fetching playlist from ${job.source_url}`);
    const response = await fetch(job.source_url);
    const m3uString = await response.text();
    const playlist = parser.parse(m3uString);

    let parsed = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // 3. Cache blocklist
    const blocklistRes = await db.query('SELECT canonical_name, tvg_id, stream_url_hash FROM channel_blocklist');
    const blocklist = new Set();
    blocklistRes.rows.forEach(b => {
      if (b.canonical_name) blocklist.add(`canonical:${b.canonical_name}`);
      if (b.tvg_id) blocklist.add(`tvgid:${b.tvg_id}`);
    });

    // 4. Group by channel for deduplication
    const groupedChannels = {};
    for (const item of playlist.items) {
      if (!item.name || !item.url) continue;
      
      parsed++;
      
      // Update progress periodically
      if (parsed % 500 === 0) {
        await db.query('UPDATE import_jobs SET total_parsed = $1 WHERE id = $2', [parsed, jobId]);
      }

      // Apply Filters
      if (options.skipAdult && item.group.title && item.group.title.toLowerCase().includes('adult')) {
        skipped++;
        continue;
      }
      // Assuming tvg-country is available or fallback
      const tvgCountry = item.tvg.country || '';
      if (options.country && tvgCountry.toLowerCase() !== options.country.toLowerCase()) {
         // This is a naive check; iptv-org puts country in group sometimes or not at all.
         // For a safer import, we'll bypass strict country if it's missing but user wanted it, or just use it if present
         if (tvgCountry) {
            skipped++;
            continue;
         }
      }

      const canonicalName = normalizeString(item.name);
      const tvgId = item.tvg.id || '';

      if (blocklist.has(`canonical:${canonicalName}`) || (tvgId && blocklist.has(`tvgid:${tvgId}`))) {
        skipped++;
        continue;
      }

      if (!groupedChannels[canonicalName]) {
        groupedChannels[canonicalName] = {
          name: item.name,
          canonical_name: canonicalName,
          tvg_id: tvgId,
          tvg_name: item.tvg.name || item.name,
          logo_url: item.tvg.logo || '',
          language: item.tvg.language || 'English', // default
          country: item.tvg.country || 'Unknown',
          category_id: mapCategory(item.group.title),
          source: 'iptv-org',
          streams: []
        };
      }
      
      groupedChannels[canonicalName].streams.push({
        stream_url: item.url,
        user_agent: item.http.user_agent || null,
        referer: item.http.referrer || null,
      });
    }

    // 5. Process Grouped Channels
    let processed = 0;
    for (const [canonical, channelData] of Object.entries(groupedChannels)) {
      processed++;
      if (processed % 100 === 0) {
        await db.query(
          'UPDATE import_jobs SET inserted = $1, updated = $2, skipped = $3 WHERE id = $4',
          [inserted, updated, skipped, jobId]
        );
      }
      try {
        // Check if channel already exists
        let existingChannel = null;
        let cRes = await db.query(
          'SELECT id, is_hidden, is_removed FROM channels WHERE canonical_name = $1 OR (tvg_id != \'\' AND tvg_id = $2) LIMIT 1',
          [canonical, channelData.tvg_id]
        );

        if (cRes.rows.length > 0) {
          existingChannel = cRes.rows[0];
        } else {
          // Try matching by exact name
          cRes = await db.query('SELECT id, is_hidden, is_removed FROM channels WHERE name = $1 LIMIT 1', [channelData.name]);
          if (cRes.rows.length > 0) existingChannel = cRes.rows[0];
        }

        if (existingChannel) {
          // If it's hidden or removed, skip adding new streams or updating (unless forced)
          if (existingChannel.is_hidden || existingChannel.is_removed) {
            skipped++;
            continue;
          }

          // Update existing channel
          await db.query(
            `UPDATE channels SET 
              tvg_id = COALESCE(NULLIF(tvg_id, ''), $1),
              logo_url = COALESCE(NULLIF(logo_url, ''), $2),
              canonical_name = COALESCE(NULLIF(canonical_name, ''), $3),
              updated_at = NOW()
             WHERE id = $4`,
            [channelData.tvg_id, channelData.logo_url, canonical, existingChannel.id]
          );

          // Add streams
          for (const s of channelData.streams) {
            await db.query(`
              INSERT INTO channel_streams (channel_id, stream_url, user_agent, referer, source_name)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (channel_id, stream_url) DO NOTHING
            `, [existingChannel.id, s.stream_url, s.user_agent, s.referer, channelData.source]);
          }
          updated++;
        } else {
          // Insert new channel
          // Insert new channel with first stream as default stream_url
          const defaultStream = channelData.streams.length > 0 ? channelData.streams[0].stream_url : '';
          const insertRes = await db.query(`
            INSERT INTO channels 
              (name, display_name, canonical_name, tvg_id, logo_url, category_id, language, country, source, status, stream_url)
            VALUES 
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
            RETURNING id
          `, [
            channelData.name, channelData.name, canonical, channelData.tvg_id,
            channelData.logo_url, channelData.category_id, channelData.language, 
            channelData.country, channelData.source, defaultStream
          ]);

          const newChannelId = insertRes.rows[0].id;
          
          let isFirst = true;
          for (const s of channelData.streams) {
            await db.query(`
              INSERT INTO channel_streams (channel_id, stream_url, user_agent, referer, source_name, is_primary)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [newChannelId, s.stream_url, s.user_agent, s.referer, channelData.source, isFirst]);
            isFirst = false;
          }
          inserted++;
        }
      } catch (err) {
        console.error(`Error processing channel ${canonical}:`, err);
        errors.push({ channel: canonical, error: err.message });
      }
    }

    // 6. Complete Job
    await db.query(`
      UPDATE import_jobs 
      SET status = 'completed', completed_at = NOW(), total_parsed = $1, inserted = $2, updated = $3, skipped = $4, errors_json = $5
      WHERE id = $6
    `, [parsed, inserted, updated, skipped, JSON.stringify(errors), jobId]);
    
    console.log(`[ImportEngine] Job ${jobId} completed. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);

  } catch (globalErr) {
    console.error(`[ImportEngine] Job ${jobId} failed:`, globalErr);
    await db.query('UPDATE import_jobs SET status = $1, errors_json = $2 WHERE id = $3', ['failed', JSON.stringify([{error: globalErr.message}]), jobId]);
  }
};

module.exports = {
  runImportJob
};

const https = require('https');
const db = require('../config/db');

// Helper to download content
function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}, status: ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Very simple M3U parser
function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      currentChannel = { headers: {} };
      
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];
      
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1];
      
      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch) currentChannel.group = groupMatch[1];
      
      const parts = line.split(',');
      currentChannel.name = parts[parts.length - 1].trim();
      
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      if (currentChannel) currentChannel.headers['User-Agent'] = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
    } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
      if (currentChannel) currentChannel.headers['Referer'] = line.replace('#EXTVLCOPT:http-referrer=', '').trim();
    } else if (!line.startsWith('#')) {
      if (currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
  }
  return channels;
}

// Normalizes name for matching
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function runIptvOrgSync(importGlobal = true) {
  console.log('[iptv-org] Starting sync...');
  
  try {
    const urls = [
      'https://iptv-org.github.io/iptv/countries/in.m3u'
    ];
    if (importGlobal) {
      urls.push('https://iptv-org.github.io/iptv/index.m3u');
    }
    
    let allParsedChannels = [];
    for (const url of urls) {
      console.log(`[iptv-org] Downloading M3U from ${url}`);
      const m3uContent = await download(url);
      const parsedChannels = parseM3U(m3uContent);
      console.log(`[iptv-org] Parsed ${parsedChannels.length} channels from ${url}.`);
      allParsedChannels = allParsedChannels.concat(parsedChannels);
    }

    // Deduplicate parsed channels by URL to save processing
    const uniqueChannelsMap = new Map();
    for (const c of allParsedChannels) {
      if (!uniqueChannelsMap.has(c.url)) {
        uniqueChannelsMap.set(c.url, c);
      }
    }
    const finalParsedChannels = Array.from(uniqueChannelsMap.values());
    console.log(`[iptv-org] Total unique channels to process: ${finalParsedChannels.length}`);

    // Fetch DB channels
    const dbRes = await db.query('SELECT id, name, tvg_id, stream_url FROM channels');
    const dbChannels = dbRes.rows;
    
    // Create lookup maps
    const dbByTvgId = {};
    const dbByName = {};
    dbChannels.forEach(c => {
      if (c.tvg_id) dbByTvgId[c.tvg_id] = c;
      dbByName[normalizeName(c.name)] = c;
    });

    let updatedCount = 0;
    let newCount = 0;
    
    // Ensure unknown category exists for new imports
    let defaultCatId = null;
    const catRes = await db.query("SELECT id FROM categories WHERE name ILIKE 'General' OR name ILIKE 'Unknown' LIMIT 1");
    if (catRes.rows.length > 0) {
      defaultCatId = catRes.rows[0].id;
    } else {
      const newCat = await db.query("INSERT INTO categories (name, status) VALUES ('General', 'active') RETURNING id");
      defaultCatId = newCat.rows[0].id;
    }

    // Match and Update
    for (const pc of finalParsedChannels) {
      let matchedDbChannel = null;
      
      if (pc.tvgId && dbByTvgId[pc.tvgId]) {
        matchedDbChannel = dbByTvgId[pc.tvgId];
      } else {
        const normName = normalizeName(pc.name);
        if (dbByName[normName]) matchedDbChannel = dbByName[normName];
      }

      // Extract country code from tvgId (e.g., AajTak.in -> IN)
      let extractedCountry = 'INTL';
      if (pc.tvgId) {
        const parts = pc.tvgId.split('.');
        if (parts.length > 1) {
          extractedCountry = parts[parts.length - 1].toUpperCase().substring(0, 10);
        }
      }
      
      // Only Indian channels are visible by default
      const isVisibleApp = (extractedCountry === 'IN' || extractedCountry === 'INTL_IN');

      if (matchedDbChannel) {
        let needsUpdate = false;
        let updateQuery = 'UPDATE channels SET updated_at = NOW()';
        const updateParams = [];

        // Backfill missing logo from M3U
        if (pc.logo && (!matchedDbChannel.logo_url || matchedDbChannel.logo_url.trim() === '')) {
          updateParams.push(pc.logo);
          updateQuery += `, logo_url = $${updateParams.length}`;
          matchedDbChannel.logo_url = pc.logo;
          needsUpdate = true;
        }

        // Update URL if changed
        if (matchedDbChannel.stream_url !== pc.url) {
          updateParams.push(pc.url);
          updateQuery += `, stream_url = $${updateParams.length}, health_status = 'unknown'`;
          updateParams.push(extractedCountry);
          updateQuery += `, country = COALESCE(country, $${updateParams.length})`;
          updateParams.push(isVisibleApp);
          updateQuery += `, is_visible_app = $${updateParams.length}`;
          needsUpdate = true;

          // Add to channel_streams as backup
          await db.query(`
            INSERT INTO channel_streams (channel_id, stream_url, quality, priority, health_status)
            VALUES ($1, $2, 'auto', 10, 'unknown')
            ON CONFLICT DO NOTHING
          `, [matchedDbChannel.id, pc.url]);
        }

        if (needsUpdate) {
          updateParams.push(matchedDbChannel.id);
          updateQuery += ` WHERE id = $${updateParams.length}`;
          await db.query(updateQuery, updateParams);
          updatedCount++;
        }
      } else {
        // New channel auto-import
        const cRes = await db.query(`
          INSERT INTO channels (name, category_id, stream_url, tvg_id, logo_url, is_premium, is_paid, status, health_status, country, is_visible_app)
          VALUES ($1, $2, $3, $4, $5, false, false, 'active', 'unknown', $6, $7)
          RETURNING id
        `, [pc.name, defaultCatId, pc.url, pc.tvgId || null, pc.logo || null, extractedCountry, isVisibleApp]);
        
        // Save to maps to avoid duplicates within the same run
        if (pc.tvgId) dbByTvgId[pc.tvgId] = { id: cRes.rows[0].id, stream_url: pc.url, logo_url: pc.logo };
        dbByName[normalizeName(pc.name)] = { id: cRes.rows[0].id, stream_url: pc.url, logo_url: pc.logo };
        newCount++;
      }
    }
    
    console.log(`[iptv-org] Sync complete. Updated: ${updatedCount}, Auto-imported: ${newCount}.`);

    // Backfill remaining missing logos from iptv-org official channel registry
    await backfillMissingLogos();

    return { updatedCount, newCount };
    
  } catch (err) {
    console.error('[iptv-org] Sync failed:', err);
    throw err;
  }
}

async function backfillMissingLogos() {
  console.log('[logo-enricher] Fetching iptv-org channels.json for logo backfill...');
  try {
    const raw = await download('https://iptv-org.github.io/api/channels.json');
    const apiChannels = JSON.parse(raw);
    
    const logoByTvgId = new Map();
    const logoByName = new Map();

    for (const c of apiChannels) {
      if (c.logo && typeof c.logo === 'string' && c.logo.trim() !== '') {
        if (c.id) logoByTvgId.set(c.id.toLowerCase(), c.logo.trim());
        if (c.name) logoByName.set(normalizeName(c.name), c.logo.trim());
      }
    }

    const missingRes = await db.query(
      `SELECT id, name, tvg_id FROM channels WHERE logo_url IS NULL OR TRIM(logo_url) = ''`
    );

    console.log(`[logo-enricher] Found ${missingRes.rows.length} channels with missing logos.`);

    let updatedLogosCount = 0;
    for (const ch of missingRes.rows) {
      let foundLogo = null;
      if (ch.tvg_id && logoByTvgId.has(ch.tvg_id.toLowerCase())) {
        foundLogo = logoByTvgId.get(ch.tvg_id.toLowerCase());
      }
      if (!foundLogo) {
        const norm = normalizeName(ch.name);
        if (logoByName.has(norm)) {
          foundLogo = logoByName.get(norm);
        }
      }

      if (foundLogo) {
        await db.query(`UPDATE channels SET logo_url = $1, updated_at = NOW() WHERE id = $2`, [foundLogo, ch.id]);
        updatedLogosCount++;
      }
    }
    console.log(`[logo-enricher] Successfully backfilled logos for ${updatedLogosCount} channels!`);
  } catch (err) {
    console.error('[logo-enricher] Error backfilling logos:', err.message);
  }
}

module.exports = { runIptvOrgSync, parseM3U };

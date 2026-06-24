/**
 * IPTV-org Data Import Script
 * Fetches data from iptv-org API and imports into PostgreSQL database
 * Usage: node scripts/import-iptv-org.js
 */

const db = require('../src/config/db');

// IPTV-org API endpoints
const APIs = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  categories: 'https://iptv-org.github.io/api/categories.json',
  logos: 'https://iptv-org.github.io/api/logos.json',
  blocklist: 'https://iptv-org.github.io/api/blocklist.json',
};

const MAX_CHANNELS = 100;
const SKIP_NSFW = true;
const SKIP_CLOSED = true;
const SKIP_BLOCKLISTED = true;

// Helper function to safely fetch JSON
async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
    return null;
  }
}

// Filter out NSFW channels
function isNSFW(channel) {
  if (!channel.categories) return false;
  return channel.categories.some(
    (cat) => cat.toLowerCase() === 'xxx' || cat.toLowerCase() === 'adult'
  );
}

// Filter closed channels
function isClosed(channel) {
  return channel.closed === true || channel.is_nsfw === true;
}

// Main import function
async function importIPTVData() {
  console.log('Starting IPTV-org data import...');
  console.log('Fetching data from iptv-org API...');

  // Fetch all data sources
  const [channelsData, streamsData, categoriesData, logosData, blocklistData] =
    await Promise.all([
      fetchJSON(APIs.channels),
      fetchJSON(APIs.streams),
      fetchJSON(APIs.categories),
      fetchJSON(APIs.logos),
      fetchJSON(APIs.blocklist),
    ]);

  if (!channelsData) {
    console.error('Failed to fetch channels data. Aborting.');
    process.exit(1);
  }

  console.log(`Fetched ${channelsData.length} channels`);
  console.log(`Fetched ${streamsData?.length || 0} streams`);
  console.log(`Fetched ${categoriesData?.length || 0} categories`);
  console.log(`Fetched ${logosData?.length || 0} logos`);
  console.log(`Fetched ${blocklistData?.length || 0} blocklisted entries`);

  // Build blocklist set (channel IDs)
  const blocklistedIds = new Set();
  if (blocklistData && Array.isArray(blocklistData)) {
    blocklistData.forEach((entry) => {
      if (entry.channel) blocklistedIds.add(entry.channel);
    });
  }
  console.log(`Blocklisted channel IDs: ${blocklistedIds.size}`);

  // Build logos map (channel ID -> logo URL)
  const logosMap = new Map();
  if (logosData && Array.isArray(logosData)) {
    logosData.forEach((logo) => {
      if (logo.channel && logo.url) {
        logosMap.set(logo.channel, logo.url);
      }
    });
  }
  console.log(`Logos mapped: ${logosMap.size}`);

  // Build categories map (category name -> normalized name)
  const categoriesMap = new Map();
  if (categoriesData && Array.isArray(categoriesData)) {
    categoriesData.forEach((cat) => {
      categoriesMap.set(cat.id, cat);
    });
  }

  // Build streams map (channel ID -> stream URL from .m3u8 or first stream)
  const streamsMap = new Map();
  if (streamsData && Array.isArray(streamsData)) {
    streamsData.forEach((stream) => {
      if (stream.channel) {
        // Prefer .m3u8 streams
        const url = stream.url || '';
        if (url.includes('.m3u8') || !streamsMap.has(stream.channel)) {
          streamsMap.set(stream.channel, {
            url: stream.url,
            referrer: stream.http_referrer || null,
            user_agent: stream.http_user_agent || null,
            status: stream.status || 'unknown',
            // resolution info
            width: stream.width || null,
            height: stream.height || null,
          });
        }
      }
    });
  }
  console.log(`Streams mapped: ${streamsMap.size}`);

  // Filter channels
  let filteredChannels = channelsData;

  // NSFW filter
  if (SKIP_NSFW) {
    filteredChannels = filteredChannels.filter((c) => !isNSFW(c));
    console.log(`After NSFW filter: ${filteredChannels.length}`);
  }

  // Closed filter
  if (SKIP_CLOSED) {
    filteredChannels = filteredChannels.filter((c) => !isClosed(c));
    console.log(`After closed filter: ${filteredChannels.length}`);
  }

  // Blocklist filter
  if (SKIP_BLOCKLISTED) {
    filteredChannels = filteredChannels.filter((c) => !blocklistedIds.has(c.id));
    console.log(`After blocklist filter: ${filteredChannels.length}`);
  }

  // Only include channels with at least one stream URL
  filteredChannels = filteredChannels.filter((c) => {
    const stream = streamsMap.get(c.id);
    return stream && stream.url && stream.url.trim().length > 0;
  });
  console.log(`After stream availability filter: ${filteredChannels.length}`);

  // Sort by: first, channels with actual stream URLs, then by name
  // Also prioritise non-closed and channels that have been recently checked (if has broadcast_area)
  filteredChannels.sort((a, b) => {
    const aHasStream = streamsMap.has(a.id) ? 1 : 0;
    const bHasStream = streamsMap.has(b.id) ? 1 : 0;
    if (aHasStream !== bHasStream) return bHasStream - aHasStream;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Take only the first MAX_CHANNELS
  const channelsToImport = filteredChannels.slice(0, MAX_CHANNELS);
  console.log(`Channels to import: ${channelsToImport.length}`);

  // Prepare categories for insertion
  const allCategoryNamesSet = new Set();
  channelsToImport.forEach((c) => {
    if (c.categories) {
      c.categories.forEach((cat) => allCategoryNamesSet.add(cat));
    }
  });
  const allCategoryNames = Array.from(allCategoryNamesSet);
  console.log(`Categories to insert/update: ${allCategoryNames.length}`);

  try {
    // Insert or update categories
    const catIdMap = new Map();
    for (const catName of allCategoryNames) {
      const insertResult = await db.query(
        `INSERT INTO categories (name, icon_url, status, sort_order)
         VALUES ($1, $2, 'active', $3)
         ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [catName, '', 0]
      );
      catIdMap.set(catName, insertResult.rows[0].id);
    }
    console.log('Categories inserted/updated successfully');

    // Insert channels
    let insertedCount = 0;
    for (let i = 0; i < channelsToImport.length; i++) {
      const channel = channelsToImport[i];
      const stream = streamsMap.get(channel.id);
      const primaryCatName = channel.categories && channel.categories.length > 0
        ? channel.categories[0]
        : 'General';
      const categoryId = catIdMap.get(primaryCatName) || null;
      const logoUrl = logosMap.get(channel.id) || '';
      const streamUrl = stream ? stream.url : '';
      const backupUrl = '';
      const language = channel.languages && channel.languages.length > 0
        ? channel.languages[0]
        : 'Unknown';
      const country = channel.country || '';
      const referrer = stream ? stream.referrer : null;
      const user_agent = stream ? stream.user_agent : null;

      // Detect quality
      let quality = 'HD';
      if (stream && stream.height) {
        if (stream.height >= 1080) quality = 'FHD';
        else if (stream.height >= 720) quality = 'HD';
        else if (stream.height >= 480) quality = 'SD';
        else quality = 'SD';
      }

      // Mark some as featured (first 10)
      const isFeatured = i < 10;

      // Check if channel already exists by source_channel_id
      const existing = await db.query(
        `SELECT id FROM channels WHERE source_channel_id = $1 AND source = 'iptv-org'`,
        [channel.id]
      );

      if (existing.rows.length > 0) {
        // Update existing channel
        await db.query(
          `UPDATE channels SET
            name = $1,
            logo_url = $2,
            stream_url = $3,
            backup_stream_url = $4,
            category_id = $5,
            language = $6,
            quality = $7,
            status = 'active',
            is_featured = $8,
            referrer = $9,
            user_agent = $10,
            country = $11,
            last_checked_at = NOW(),
            updated_at = NOW()
          WHERE id = $12`,
          [
            channel.name,
            logoUrl,
            streamUrl,
            backupUrl,
            categoryId,
            language,
            quality,
            isFeatured,
            referrer,
            user_agent,
            country,
            existing.rows[0].id,
          ]
        );
      } else {
        // Insert new channel
        await db.query(
          `INSERT INTO channels (
            name, logo_url, stream_url, backup_stream_url, category_id,
            language, quality, status, is_featured, is_premium, sort_order,
            source, source_channel_id, referrer, user_agent, country, last_checked_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
          [
            channel.name,
            logoUrl,
            streamUrl,
            backupUrl,
            categoryId,
            language,
            quality,
            'active',
            isFeatured,
            false,
            i + 1,
            'iptv-org',
            channel.id,
            referrer,
            user_agent,
            country,
          ]
        );
        insertedCount++;
      }
    }

    console.log(`Successfully imported ${insertedCount} new channels, updated existing ones.`);
    console.log('IPTV-org data import complete!');
  } catch (err) {
    console.error('Import error:', err.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

importIPTVData();

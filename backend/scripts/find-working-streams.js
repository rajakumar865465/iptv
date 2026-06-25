/**
 * Find and Update Working Streams
 * 
 * Fetches the global iptv-org index playlist (index.m3u) and deep2772 playlist,
 * parses them, probes each active channel in the database, and if the current stream is offline,
 * searches the parsed lists for working alternatives and updates the database.
 * 
 * Usage:
 *   node scripts/find-working-streams.js
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../src/config/db');

const REQUEST_TIMEOUT = 5000;
const CONCURRENCY = 8;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36';

const PLAYLIST_URLS = [
  'https://iptv-org.github.io/iptv/index.m3u',
  'https://raw.githubusercontent.com/deep2772/Hindi_Punjabi-iptv-playlist/refs/heads/main/Hindi_Punjabi_Merged.m3u'
];

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')  // strip trailing (HD), (SD), (1080p)
    .replace(/\s*\[[^\]]+\]\s*$/g, '')  // strip trailing [Geo-blocked]
    .replace(/\b(hd|sd|fhd|uhd|4k|live|tv|channel)\b/g, '') // strip common descriptors
    .replace(/[^a-z0-9]/g, '') // remove non-alphanumeric
    .trim();
}

function makeRequest(url, method, headers = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    let req;

    const safeResolve = (val) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(backupTimer);
      resolve(val);
    };

    const backupTimer = setTimeout(() => {
      if (req) {
        try { req.destroy(); } catch {}
      }
      safeResolve({ ok: false, error: 'backup_timeout' });
    }, REQUEST_TIMEOUT + 1500);

    let parsed;
    try { parsed = new URL(url); } catch { return safeResolve({ ok: false, error: 'invalid_url' }); }
    const client = parsed.protocol === 'https:' ? https : http;

    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || USER_AGENT,
      ...(headers['Referer'] ? { 'Referer': headers['Referer'] } : {}),
    };
    if (method === 'GET') reqHeaders['Range'] = 'bytes=0-2048';

    req = client.request(url, {
      method,
      timeout: REQUEST_TIMEOUT,
      headers: reqHeaders,
    }, (res) => {
      const status = res.statusCode;
      const contentType = res.headers['content-type'] || '';

      if (method === 'GET') {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          body += chunk;
          if (body.length > 2048) res.destroy();
        });
        res.on('end', () => {
          safeResolve({ ok: status >= 200 && status < 400, status, contentType, body });
        });
        res.on('error', () => safeResolve({ ok: false, error: 'response_error' }));
      } else {
        res.resume(); // drain
        safeResolve({ ok: status >= 200 && status < 400, status, contentType, body: '' });
      }
    });

    req.on('error', () => safeResolve({ ok: false, error: 'request_error' }));
    req.on('timeout', () => { 
      try { req.destroy(); } catch {}
      safeResolve({ ok: false, error: 'timeout' }); 
    });
    req.end();
  });
}

async function checkStream(url, customHeaders = {}) {
  if (!url || url.trim() === '') return { ok: false, error: 'empty_url' };

  // Step 1: HEAD
  const headResult = await makeRequest(url, 'HEAD', customHeaders);
  if (headResult.ok) {
    const ct = headResult.contentType.toLowerCase();
    const isHLS = ct.includes('mpegurl') || ct.includes('m3u') || url.toLowerCase().endsWith('.m3u8');
    if (isHLS) return { ok: true, method: 'HEAD' };
  }

  // Step 2: GET with Range header
  const getResult = await makeRequest(url, 'GET', customHeaders);
  if (!getResult.ok) return { ok: false, error: getResult.error || `HTTP_${getResult.status}` };

  const ct = (getResult.contentType || '').toLowerCase();
  const body = getResult.body || '';
  const urlLower = url.toLowerCase();

  const isHLS = ct.includes('mpegurl') || ct.includes('m3u') ||
                urlLower.endsWith('.m3u8') ||
                body.trimStart().startsWith('#EXTM3U') ||
                body.includes('#EXT-X');

  return { ok: isHLS, method: 'GET' };
}

async function fetchPlaylistText(url) {
  console.log(`Fetching playlist: ${url}...`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`Failed to fetch playlist ${url}:`, err.message);
    return '';
  }
}

function parseM3U(text) {
  const streams = [];
  const lines = text.split('\n');
  let current = null;
  let extraUserAgent = null;
  let extraReferrer = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('#EXTINF:')) {
      const tvgName = line.match(/tvg-name="([^"]*)"/) ?. [1] || '';
      const commaIdx = line.lastIndexOf(',');
      const displayName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      const name = displayName || tvgName;
      const userAgent = line.match(/http-user-agent="([^"]*)"/) ?. [1] || '';
      const referrer = line.match(/http-referrer="([^"]*)"/) ?. [1] || '';
      current = { name, userAgent, referrer };
      extraUserAgent = null;
      extraReferrer = null;
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      extraUserAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
    } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
      extraReferrer = line.replace('#EXTVLCOPT:http-referrer=', '').trim();
    } else if (line && !line.startsWith('#') && current) {
      const ua = current.userAgent || extraUserAgent || '';
      const ref = current.referrer || extraReferrer || '';
      streams.push({
        name: current.name,
        url: line,
        userAgent: ua,
        referrer: ref
      });
      current = null;
      extraUserAgent = null;
      extraReferrer = null;
    }
  }
  return streams;
}

async function runConcurrent(items, limit, fn) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  console.log('=== Find & Update Working Streams ===\n');

  // Load playlists
  const globalStreamsMap = new Map(); // normalizedName -> list of streams
  let parsedCount = 0;

  for (const playlistUrl of PLAYLIST_URLS) {
    const text = await fetchPlaylistText(playlistUrl);
    if (!text) continue;
    const streams = parseM3U(text);
    console.log(`Parsed ${streams.length} stream entries from playlist.`);
    for (const s of streams) {
      const norm = normalizeName(s.name);
      if (!norm) continue;
      if (!globalStreamsMap.has(norm)) {
        globalStreamsMap.set(norm, []);
      }
      globalStreamsMap.get(norm).push(s);
      parsedCount++;
    }
  }
  console.log(`Total unique normalized channel names in index: ${globalStreamsMap.size}\n`);

  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  // Load active channels from database
  console.log('Fetching active channels from database...');
  let query = `SELECT id, name, stream_url, user_agent, referrer FROM channels WHERE status = 'active' ORDER BY id ASC`;
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  const { rows: channels } = await db.query(query);
  console.log(`Found ${channels.length} active channels to check.\n`);

  let checked = 0;
  let workingCount = 0;
  let fixedCount = 0;
  let offlineCount = 0;

  const BATCH_SIZE = 50;
  for (let startIdx = 0; startIdx < channels.length; startIdx += BATCH_SIZE) {
    const batchChannels = channels.slice(startIdx, startIdx + BATCH_SIZE);
    console.log(`\n--- Processing Batch ${Math.floor(startIdx / BATCH_SIZE) + 1}/${Math.ceil(channels.length / BATCH_SIZE)} (${startIdx + 1} to ${Math.min(startIdx + BATCH_SIZE, channels.length)}) ---`);
    
    const updates = []; // collect updates for this batch

    await runConcurrent(batchChannels, CONCURRENCY, async (ch) => {
      const name = ch.name;
      const currentUrl = ch.stream_url;
      const headers = {};
      if (ch.user_agent) headers['User-Agent'] = ch.user_agent;
      if (ch.referrer) headers['Referer'] = ch.referrer;

      // 1. Check current stream
      let result = await checkStream(currentUrl, headers);
      checked++;

      if (result.ok) {
        updates.push({
          query: `UPDATE channels SET health_status = 'online', last_checked_at = NOW() WHERE id = $1`,
          params: [ch.id],
          type: 'working',
          name
        });
        workingCount++;
        return;
      }

      // 2. Stream is NOT working, find alternative in global index
      const norm = normalizeName(name);
      const alternatives = globalStreamsMap.get(norm) || [];
      
      // Filter out alternatives that have the exact same URL
      const uniqueAlts = alternatives.filter(alt => alt.url !== currentUrl);

      if (uniqueAlts.length === 0) {
        updates.push({
          query: `UPDATE channels SET health_status = 'offline', last_checked_at = NOW() WHERE id = $1`,
          params: [ch.id],
          type: 'offline_no_alt',
          name,
          currentUrl
        });
        offlineCount++;
        return;
      }

      // Probe alternatives
      let foundWorking = false;
      for (const alt of uniqueAlts) {
        const altHeaders = {};
        if (alt.userAgent) altHeaders['User-Agent'] = alt.userAgent;
        if (alt.referrer) altHeaders['Referer'] = alt.referrer;

        const altResult = await checkStream(alt.url, altHeaders);
        if (altResult.ok) {
          updates.push({
            query: `UPDATE channels SET 
              stream_url = $1, 
              user_agent = $2, 
              referrer = $3, 
              health_status = 'online', 
              last_checked_at = NOW() 
             WHERE id = $4`,
            params: [alt.url, alt.userAgent || null, alt.referrer || null, ch.id],
            type: 'fixed',
            name,
            currentUrl,
            newUrl: alt.url
          });
          foundWorking = true;
          fixedCount++;
          break;
        }
      }

      if (!foundWorking) {
        updates.push({
          query: `UPDATE channels SET health_status = 'offline', last_checked_at = NOW() WHERE id = $1`,
          params: [ch.id],
          type: 'offline_alt_failed',
          name,
          altCount: uniqueAlts.length
        });
        offlineCount++;
      }
    });

    // Write all updates for this batch to database
    console.log(`Writing ${updates.length} updates for current batch to DB...`);
    for (const u of updates) {
      try {
        await db.query(u.query, u.params);
        if (u.type === 'fixed') {
          console.log(`  ✔ FIXED: ${u.name}\n    Old: ${u.currentUrl}\n    New: ${u.newUrl}`);
        } else if (u.type === 'offline_no_alt') {
          console.log(`  ✗ Offline (No Alternatives): ${u.name}`);
        } else if (u.type === 'offline_alt_failed') {
          console.log(`  ✗ Offline (Alternatives Failed): ${u.name} | Tried ${u.altCount} alts`);
        }
      } catch (err) {
        console.error(`  Error writing update for ${u.name}:`, err.message);
      }
    }
  }

  console.log('\n=== Stream Health Check & Fix Summary ===');
  console.log(`Checked:      ${checked}`);
  console.log(`Still Working:${workingCount}`);
  console.log(`Fixed/Updated:${fixedCount}`);
  console.log(`Offline:      ${offlineCount}`);

  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Failed to run stream fix:', err);
  await db.pool.end();
  process.exit(1);
});

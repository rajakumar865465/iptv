/**
 * Advanced HLS Stream Checker
 * Fetches M3U8, parses variants, fetches a TS segment.
 * Calculates health scores and assigns accurate failure reasons.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../src/config/db');

const REQUEST_TIMEOUT = 10000;
const CONCURRENCY = 10;
const USER_AGENT = 'ExoPlayer/2.18.1 (Linux; Android 11)';

function makeRequest(url, method, headers = {}, isSegment = false) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve({ ok: false, error: 'invalid_url' }); }
    const client = parsed.protocol === 'https:' ? https : http;

    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || USER_AGENT,
      ...(headers['Referer'] ? { 'Referer': headers['Referer'] } : {}),
    };
    
    // For segment fetching, we only need the first 4KB to verify it exists
    if (isSegment) reqHeaders['Range'] = 'bytes=0-4096';

    const req = client.request(url, {
      method,
      timeout: REQUEST_TIMEOUT,
      headers: reqHeaders,
    }, (res) => {
      const status = res.statusCode;
      const contentType = (res.headers['content-type'] || '').toLowerCase();

      // Collect body
      let body = '';
      res.setEncoding(isSegment ? 'binary' : 'utf8');
      
      res.on('data', chunk => {
        body += chunk;
        if (body.length > (isSegment ? 4096 : 256000)) res.destroy(); // Limit m3u8 to 250KB, segment to 4KB
      });
      
      res.on('end', () => {
        resolve({ ok: status >= 200 && status < 400, status, contentType, body });
      });
      
      res.on('error', (err) => resolve({ ok: false, error: 'response_error', msg: err.message }));
    });

    req.on('error', (err) => resolve({ ok: false, error: 'request_error', msg: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

function resolveUrl(base, relative) {
  if (relative.startsWith('http')) return relative;
  try { return new URL(relative, base).href; } catch { return null; }
}

async function checkDeepStream(url, customHeaders = {}) {
  if (!url || url.trim() === '') return { ok: false, score: 0, reason: 'empty_url' };

  // Step 1: Fetch manifest
  const m3Result = await makeRequest(url, 'GET', customHeaders);
  if (!m3Result.ok) {
    if (m3Result.status === 403) return { ok: false, score: 0, reason: 'forbidden_403' };
    if (m3Result.error === 'timeout') return { ok: false, score: 0, reason: 'timeout' };
    return { ok: false, score: 0, reason: `http_${m3Result.status || m3Result.error}` };
  }

  const body = m3Result.body.trim();
  if (!body.startsWith('#EXTM3U')) {
    if (body.includes('<html')) return { ok: false, score: 0, reason: 'geo_blocked_html' };
    return { ok: false, score: 0, reason: 'not_hls' };
  }

  let mediaPlaylistUrl = url;

  // Step 2: Check if master playlist, if so, get highest bandwidth variant
  if (body.includes('#EXT-X-STREAM-INF')) {
    const lines = body.split('\n');
    let bestUrl = null;
    let highestBandwidth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1]) : 0;
        if (bw >= highestBandwidth && i + 1 < lines.length && !lines[i+1].startsWith('#')) {
          highestBandwidth = bw;
          bestUrl = lines[i+1].trim();
        }
      }
    }
    
    if (bestUrl) {
      const resolved = resolveUrl(url, bestUrl);
      if (resolved) {
        mediaPlaylistUrl = resolved;
        const subResult = await makeRequest(mediaPlaylistUrl, 'GET', customHeaders);
        if (!subResult.ok) return { ok: false, score: 20, reason: 'variant_failed' };
        if (!subResult.body.includes('#EXTINF')) return { ok: false, score: 10, reason: 'variant_not_media' };
        mediaPlaylistUrl = resolved; // Confirmed media playlist
      }
    }
  }

  // Step 3: We have a media playlist, extract a segment
  let mediaBody = mediaPlaylistUrl === url ? body : (await makeRequest(mediaPlaylistUrl, 'GET', customHeaders)).body;
  if (!mediaBody || !mediaBody.includes('#EXTINF')) return { ok: false, score: 0, reason: 'missing_segments' };

  const lines = mediaBody.split('\n');
  let segmentUrl = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF') && i + 1 < lines.length && !lines[i+1].startsWith('#')) {
      segmentUrl = lines[i+1].trim();
      break;
    }
  }

  if (!segmentUrl) return { ok: false, score: 20, reason: 'no_segment_found' };

  // Step 4: Fetch segment
  const fullSegmentUrl = resolveUrl(mediaPlaylistUrl, segmentUrl);
  if (!fullSegmentUrl) return { ok: false, score: 0, reason: 'invalid_segment_url' };

  const startTime = Date.now();
  const segResult = await makeRequest(fullSegmentUrl, 'GET', customHeaders, true);
  const latency = Date.now() - startTime;

  if (!segResult.ok) return { ok: false, score: 30, reason: `segment_${segResult.status || segResult.error}` };

  // Score based on latency (if it took 8+ seconds for 4KB, it's terrible)
  let score = 100;
  if (latency > 5000) score = 40;
  else if (latency > 2000) score = 70;

  return { ok: true, score, reason: 'stable', latency };
}

async function runWithConcurrency(items, fn, limit) {
  const results = [];
  let i = 0;
  while (i < items.length) {
    const batch = items.slice(i, i + limit);
    results.push(...await Promise.all(batch.map(fn)));
    i += limit;
  }
  return results;
}

async function runDeepCheck() {
  console.log('=== Deep Stream Health Checker ===');
  
  // Check if channel_streams table exists
  const hasStreams = await db.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_streams'`);
  if (hasStreams.rows.length === 0) {
    console.error('Migration 009 not applied. Exiting.');
    process.exit(1);
  }

  const { rows: streams } = await db.query(
    `SELECT cs.id, cs.channel_id, cs.stream_url, cs.user_agent, cs.referer, c.name 
     FROM channel_streams cs
     JOIN channels c ON cs.channel_id = c.id
     WHERE c.status IN ('active', 'disabled')
     ORDER BY cs.last_checked_at ASC NULLS FIRST`
  );

  console.log(`Deep checking ${streams.length} stream sources...`);

  await runWithConcurrency(streams, async (st) => {
    const headers = {};
    if (st.user_agent) headers['User-Agent'] = st.user_agent;
    if (st.referer) headers['Referer'] = st.referer;

    const res = await checkDeepStream(st.stream_url, headers);
    const healthStatus = res.score >= 70 ? 'online' : (res.score > 0 ? 'unstable' : 'offline');

    await db.query(`
      UPDATE channel_streams 
      SET health_status = $1, 
          health_score = $2, 
          health_reason = $3,
          last_checked_at = NOW(),
          fail_count = CASE WHEN $2 = 0 THEN fail_count + 1 ELSE 0 END,
          success_count = CASE WHEN $2 >= 70 THEN success_count + 1 ELSE success_count END,
          last_success_at = CASE WHEN $2 >= 70 THEN NOW() ELSE last_success_at END,
          last_failed_at = CASE WHEN $2 < 70 THEN NOW() ELSE last_failed_at END
      WHERE id = $4
    `, [healthStatus, res.score, res.reason, st.id]);

    const icon = res.score >= 70 ? '🟢' : (res.score > 0 ? '🟡' : '🔴');
    console.log(`${icon} [CH:${st.channel_id} | S:${st.id}] Score:${res.score} | Reason:${res.reason} | ${st.name}`);
  }, CONCURRENCY);

  console.log('=== Deep Check Complete ===');
  process.exit(0);
}

runDeepCheck().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

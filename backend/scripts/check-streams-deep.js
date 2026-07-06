/**
 * check-streams-deep.js
 * Deep HLS stream validation:
 *   1. Fetch M3U8 manifest → confirm #EXTM3U
 *   2. If master playlist → open best variant
 *   3. Open media playlist → extract first segment URL
 *   4. Fetch first segment bytes → must return 200/206
 *
 * Only streams that pass segment fetch are marked health_status='online'.
 *
 * Usage:
 *   node scripts/check-streams-deep.js --all
 *   node scripts/check-streams-deep.js --pending
 *   node scripts/check-streams-deep.js --channel=42
 *   node scripts/check-streams-deep.js --concurrency=15
 */

'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const https = require('https');
const http  = require('http');
const { URL } = require('url');
const db = require('../src/config/db');

const args = process.argv.slice(2);
const OPT = {
  all:         args.includes('--all'),
  pending:     args.includes('--pending'),
  channelId:   args.find(a => a.startsWith('--channel='))?.split('=')[1] || null,
  concurrency: parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10', 10),
};

const TIMEOUT   = 10000;
const SEG_TIMEOUT = 12000;
const UA = 'ExoPlayer/2.18.1 (Linux; Android 11)';
const MAX_M3U_BYTES  = 300_000;
const MAX_SEG_BYTES  = 8_192;   // only need first 8 KB to confirm segment exists

// ─── Low-level HTTP request ────────────────────────────────────────────────
function httpGet(url, headers = {}, segmentMode = false, timeout = TIMEOUT) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve({ ok: false, reason: 'invalid_url' }); }

    const client = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || UA,
      ...(headers['Referer'] ? { 'Referer': headers['Referer'] } : {}),
      ...(segmentMode ? { 'Range': 'bytes=0-8191' } : {}),
    };

    const req = client.request(url, { method: 'GET', timeout, headers: reqHeaders }, res => {
      const status = res.statusCode;
      const ct = (res.headers['content-type'] || '').toLowerCase();
      let body = '';
      const enc = segmentMode ? 'binary' : 'utf8';
      res.setEncoding(enc);
      res.on('data', chunk => {
        body += chunk;
        const limit = segmentMode ? MAX_SEG_BYTES : MAX_M3U_BYTES;
        if (body.length > limit) {
          resolve({ ok: status >= 200 && status < 300 || status === 206, status, ct, body });
          res.destroy();
        }
      });
      res.on('end', () => resolve({ ok: status >= 200 && status < 300 || status === 206, status, ct, body }));
      res.on('error', e => resolve({ ok: false, reason: 'res_error', msg: e.message }));
    });
    req.on('error', e => resolve({ ok: false, reason: 'req_error', msg: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.end();
  });
}

function resolveUrl(base, rel) {
  if (!rel) return null;
  if (rel.startsWith('http')) return rel;
  try { return new URL(rel, base).href; } catch { return null; }
}

// ─── Deep HLS validation ──────────────────────────────────────────────────
async function checkDeep(streamUrl, customHeaders = {}) {
  if (!streamUrl || !streamUrl.startsWith('http')) {
    return { status: 'offline', score: 0, reason: 'invalid_url' };
  }

  // Step 1: Fetch manifest
  const t0 = Date.now();
  const m3u = await httpGet(streamUrl, customHeaders, false, TIMEOUT);
  if (!m3u.ok) {
    if (m3u.status === 403) return { status: 'offline', score: 0, reason: 'forbidden_403' };
    if (m3u.status === 401) return { status: 'offline', score: 0, reason: 'forbidden_403' };
    if (m3u.status === 404) return { status: 'offline', score: 0, reason: 'not_found_404' };
    if (m3u.status === 451) return { status: 'offline', score: 0, reason: 'geo_blocked' };
    if (m3u.reason === 'timeout') return { status: 'offline', score: 0, reason: 'timeout' };
    return { status: 'offline', score: 0, reason: `http_${m3u.status || m3u.reason || 'error'}` };
  }

  const body = (m3u.body || '').trim();
  // Check for geo-block HTML page
  if (body.startsWith('<') || body.includes('<html')) {
    return { status: 'offline', score: 0, reason: 'geo_blocked_html' };
  }
  if (!body.startsWith('#EXTM3U')) {
    return { status: 'offline', score: 0, reason: 'not_hls' };
  }

  let mediaUrl = streamUrl;
  let mediaBody = body;
  let variants = [];

  // Step 2: Master playlist → extract all variants and find best
  if (body.includes('#EXT-X-STREAM-INF')) {
    const lines = body.split('\n');
    let bestBw = -1, bestVariantUrl = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const width = resMatch ? parseInt(resMatch[1], 10) : 0;
        const height = resMatch ? parseInt(resMatch[2], 10) : 0;

        const next = lines[i + 1]?.trim();
        if (next && !next.startsWith('#')) {
          const variantUrl = resolveUrl(streamUrl, next);
          if (variantUrl) {
            let label = '240p';
            if (height >= 1080) label = '1080p';
            else if (height >= 720) label = '720p';
            else if (height >= 480) label = '480p';
            else if (height >= 360) label = '360p';
            
            variants.push({
              url: variantUrl,
              bandwidth: bw,
              width: width,
              height: height,
              label: height > 0 ? label : null
            });
            
            if (bw >= bestBw) {
              bestBw = bw; 
              bestVariantUrl = variantUrl;
            }
          }
        }
      }
    }
    if (bestVariantUrl) {
      const variantRes = await httpGet(bestVariantUrl, customHeaders, false, TIMEOUT);
      if (!variantRes.ok) return { status: 'offline', score: 20, reason: 'variant_failed', variants };
      mediaUrl  = bestVariantUrl;
      mediaBody = variantRes.body || '';
    }
  }

  // Step 3: Media playlist → find first segment
  if (!mediaBody.includes('#EXTINF') && !mediaBody.includes('#EXT-X-TARGETDURATION')) {
    return { status: 'offline', score: 0, reason: 'missing_segments' };
  }

  let segRelUrl = null;
  const lines = mediaBody.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('#EXTINF') && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (next && !next.startsWith('#')) { segRelUrl = next; break; }
    }
  }
  // Fallback: first non-comment non-empty line that looks like a segment
  if (!segRelUrl) {
    for (const l of lines) {
      const t = l.trim();
      if (t && !t.startsWith('#') && (t.endsWith('.ts') || t.endsWith('.aac') || t.startsWith('http') || t.includes('segment'))) {
        segRelUrl = t; break;
      }
    }
  }
  if (!segRelUrl) return { status: 'offline', score: 20, reason: 'no_segment_found', variants };

  // Step 4: Fetch segment
  const segUrl = resolveUrl(mediaUrl, segRelUrl);
  if (!segUrl) return { status: 'offline', score: 0, reason: 'invalid_segment_url', variants };

  const segRes = await httpGet(segUrl, customHeaders, true, SEG_TIMEOUT);
  const latency = Date.now() - t0;

  if (!segRes.ok) {
    if (segRes.status === 403) return { status: 'offline', score: 0, reason: 'segment_forbidden', variants };
    if (segRes.reason === 'timeout') return { status: 'offline', score: 30, reason: 'segment_timeout', variants };
    return { status: 'offline', score: 30, reason: `segment_${segRes.status || segRes.reason || 'failed'}`, variants };
  }

  // Segment loaded successfully — score by latency
  let score = 100;
  if      (latency > 8000) score = 40;
  else if (latency > 4000) score = 65;
  else if (latency > 2000) score = 80;

  const healthStatus = score >= 65 ? 'online' : 'unstable';
  return { status: healthStatus, score, reason: 'stable', latency, variants };
}

// ─── Concurrency runner ───────────────────────────────────────────────────
async function runBatched(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx  = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Deep HLS Stream Checker                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Ensure channel_streams table exists
  const tableCheck = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name='channel_streams'`
  );
  if (tableCheck.rows.length === 0) {
    console.error('channel_streams table missing. Run migration 011 first.');
    process.exit(1);
  }

  // Build query
  let whereExtra = '';
  const params   = [];
  if (OPT.channelId) {
    whereExtra = ` AND cs.channel_id = $1`;
    params.push(parseInt(OPT.channelId, 10));
  } else if (OPT.pending) {
    whereExtra = ` AND cs.health_status IN ('unknown','pending_check')`;
  }
  // --all: no extra filter

  const { rows: streams } = await db.query(
    `SELECT cs.id, cs.channel_id, cs.stream_url, cs.user_agent, cs.referer,
            cs.health_status as old_status, c.name as channel_name
     FROM channel_streams cs
     JOIN channels c ON cs.channel_id = c.id
     WHERE c.status NOT IN ('hidden','disabled') ${whereExtra}
     ORDER BY cs.last_checked_at ASC NULLS FIRST`,
    params
  );

  if (!streams.length) { console.log('No streams to check.'); process.exit(0); }
  console.log(`\nChecking ${streams.length} streams (concurrency: ${OPT.concurrency})...\n`);

  let online = 0, unstable = 0, offline = 0;
  const failReasons = {};

  await runBatched(streams, OPT.concurrency, async (st, idx) => {
    const hdrs = {};
    if (st.user_agent) hdrs['User-Agent'] = st.user_agent;
    if (st.referer)    hdrs['Referer']    = st.referer;

    const result = await checkDeep(st.stream_url, hdrs);

    // Update channel_streams
    await db.query(
      `UPDATE channel_streams SET
         health_status=$1, health_score=$2, health_reason=$3,
         last_checked_at=NOW(),
         success_count = CASE WHEN $2 >= 65 THEN success_count+1 ELSE success_count END,
         fail_count    = CASE WHEN $2 <  65 THEN fail_count+1    ELSE fail_count    END,
         last_success_at = CASE WHEN $2 >= 65 THEN NOW() ELSE last_success_at END,
         last_failed_at  = CASE WHEN $2 <  65 THEN NOW() ELSE last_failed_at  END
       WHERE id=$4`,
      [result.status, result.score, result.reason, st.id]
    );

    if (result.variants && result.variants.length > 0) {
      for (const v of result.variants) {
        await db.query(`
          INSERT INTO channel_streams 
            (channel_id, stream_url, quality_label, resolution_height, resolution_width, bitrate, is_primary, parent_stream_id, health_status, health_score, user_agent, referer)
          VALUES 
            ($1, $2, $3, $4, $5, $6, false, $7, 'unknown', 100, $8, $9)
          ON CONFLICT (channel_id, stream_url) DO UPDATE SET
            quality_label = EXCLUDED.quality_label,
            resolution_height = EXCLUDED.resolution_height,
            resolution_width = EXCLUDED.resolution_width,
            bitrate = EXCLUDED.bitrate,
            parent_stream_id = EXCLUDED.parent_stream_id
        `, [st.channel_id, v.url, v.label, v.height, v.width, v.bandwidth, st.id, st.user_agent, st.referer]);
      }
    }

    // Update parent channel health from best stream
    await db.query(
      `UPDATE channels SET
         health_status = sub.best_status,
         health_score  = sub.best_score,
         health_reason = sub.best_reason,
         last_checked_at = NOW(),
         stream_url = CASE WHEN sub.best_status='online' THEN sub.best_url ELSE stream_url END,
         active_stream_id = CASE WHEN sub.best_status='online' THEN sub.best_id ELSE active_stream_id END,
         status = CASE WHEN sub.best_status='online' THEN 'active' ELSE
                       CASE WHEN status='pending_check' THEN 'offline' ELSE status END END
       FROM (
         SELECT
           CASE WHEN MAX(health_score) >= 65 THEN 'online'
                WHEN MAX(health_score) >   0 THEN 'unstable'
                ELSE 'offline' END  AS best_status,
           MAX(health_score)        AS best_score,
           (SELECT health_reason FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_reason,
           (SELECT stream_url    FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_url,
           (SELECT id            FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_id
         FROM channel_streams WHERE channel_id=$1
       ) sub
       WHERE channels.id=$1`,
      [st.channel_id]
    );

    const icon = result.status === 'online' ? '🟢' : result.status === 'unstable' ? '🟡' : '🔴';
    const lat  = result.latency ? `${result.latency}ms` : '';
    console.log(`${icon} [${idx+1}/${streams.length}] ${st.channel_name} | ${result.status} | ${result.reason} ${lat}`);

    if (result.status === 'online')    online++;
    else if (result.status === 'unstable') unstable++;
    else                               offline++;
    failReasons[result.reason] = (failReasons[result.reason]||0) + 1;
  });

  console.log('\n╔════════════════════════════════════╗');
  console.log('║  Deep Check Results                ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`  Total checked: ${streams.length}`);
  console.log(`  🟢 Online:     ${online}`);
  console.log(`  🟡 Unstable:   ${unstable}`);
  console.log(`  🔴 Offline:    ${offline}`);
  console.log('\n  Failure reasons:');
  Object.entries(failReasons)
    .filter(([k]) => k !== 'stable')
    .sort((a,b) => b[1]-a[1])
    .slice(0, 10)
    .forEach(([k,v]) => console.log(`    ${k}: ${v}`));

  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

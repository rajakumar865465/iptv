'use strict';
/**
 * scannerController.js
 * Deep HLS Stream Checker and Scanner.
 * Validates manifests, segments, latency, and logs health issues.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../config/db');
const { success, error } = require('../utils/response');
// SSRF protection: reuse the same DNS-resolving safety check used by the
// proxy. This module makes outbound requests to DB-sourced stream_url values,
// so it must be validated before httpGet() ever touches the network.
const { isSafeExternalUrl } = require('./proxyController');

const TIMEOUT = 10000;
const SEG_TIMEOUT = 12000;
const UA = 'ExoPlayer/2.18.1 (Linux; Android 11)';
const MAX_M3U_BYTES = 300000;
const MAX_SEG_BYTES = 8192;

async function ensureScanJobsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stream_scan_jobs (
      id                 SERIAL PRIMARY KEY,
      status             VARCHAR(20) DEFAULT 'pending',
      total_channels     INTEGER DEFAULT 0,
      completed_channels INTEGER DEFAULT 0,
      failed_channels    INTEGER DEFAULT 0,
      results            JSONB,
      channel_log        JSONB DEFAULT '[]'::jsonb,
      started_at         TIMESTAMP,
      completed_at       TIMESTAMP,
      created_at         TIMESTAMP DEFAULT NOW()
    )
  `);
  // Add channel_log column to existing tables if missing
  try {
    await db.query(`ALTER TABLE stream_scan_jobs ADD COLUMN IF NOT EXISTS channel_log JSONB DEFAULT '[]'::jsonb`);
  } catch (err) {
    console.warn('[Scanner] Could not alter stream_scan_jobs table (likely ownership issue):', err.message);
  }
}

function httpGet(url, headers = {}, segmentMode = false, timeout = TIMEOUT, redirectDepth = 0) {
  return new Promise(resolve => {
    if (redirectDepth > 5) return resolve({ ok: false, reason: 'too_many_redirects' });
    let parsed;
    try { parsed = new URL(url); } catch { return resolve({ ok: false, reason: 'invalid_url' }); }

    const client = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || UA,
      ...(headers['Referer'] ? { 'Referer': headers['Referer'] } : {}),
      ...(segmentMode ? { 'Range': 'bytes=0-8191' } : {}),
    };

    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        if (req) req.destroy();
        resolve({ ok: false, reason: 'hard_timeout' });
      }
    }, timeout + 2000); // hard timeout slightly longer than socket timeout

    const req = client.request(url, { method: 'GET', timeout, headers: reqHeaders }, res => {
      const status = res.statusCode;
      
      if (status >= 300 && status < 400 && res.headers.location) {
        req.destroy();
        const nextUrl = resolveUrl(url, res.headers.location);
        return resolve(httpGet(nextUrl, headers, segmentMode, timeout, redirectDepth + 1));
      }
      
      const ct = (res.headers['content-type'] || '').toLowerCase();
      let body = '';
      const enc = segmentMode ? 'binary' : 'utf8';
      res.setEncoding(enc);

      res.on('data', chunk => {
        body += chunk;
        if (body.length > (segmentMode ? MAX_SEG_BYTES : MAX_M3U_BYTES)) {
          // Resolve BEFORE destroying — server may not honour Range header (returns 200 + full file).
          // Calling res.destroy() fires 'close' not 'end', so we must resolve here or the
          // close handler would return ok:false and mark every such segment as SEGMENT_FAILED.
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            resolve({ ok: status >= 200 && status < 300 || status === 206, status, ct, body });
          }
          res.destroy();
        }
      });
      res.on('end', () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);
        resolve({ ok: status >= 200 && status < 300 || status === 206, status, ct, body });
      });
      res.on('error', e => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({ ok: false, reason: 'res_error', msg: e.message });
        }
      });

      res.on('close', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({ ok: false, reason: 'premature_close' });
        }
      });
    });

    req.on('error', e => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'req_error', msg: e.message });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'timeout' });
      }
    });
    
    req.end();
  });
}

function resolveUrl(base, rel) {
  if (!rel) return null;
  if (rel.startsWith('http')) return rel;
  try { return new URL(rel, base).href; } catch { return null; }
}

async function checkDeep(streamUrl, customHeaders = {}) {
  if (!streamUrl || !streamUrl.startsWith('http')) return { status: 'offline', score: 0, reason: 'invalid_url' };

  // SSRF guard: validate before httpGet() touches the network. Rejects
  // private/loopback/link-local/metadata IPs and non-http(s) protocols.
  const isSafe = await isSafeExternalUrl(streamUrl);
  if (!isSafe) return { status: 'offline', score: 0, reason: 'ssrf_blocked_unsafe_url' };

  const t0 = Date.now();
  const m3u = await httpGet(streamUrl, customHeaders, false, TIMEOUT);
  if (!m3u.ok) {
    if (m3u.status === 403 || m3u.status === 401) return { status: 'offline', score: 0, reason: 'forbidden_403' };
    if (m3u.status === 404) return { status: 'offline', score: 0, reason: 'not_found_404' };
    if (m3u.status === 451) return { status: 'offline', score: 0, reason: 'geo_blocked' };
    if (m3u.reason === 'timeout') return { status: 'offline', score: 0, reason: 'timeout' };
    return { status: 'offline', score: 0, reason: `http_${m3u.status || m3u.reason || 'error'}` };
  }
  const body = (m3u.body || '').trim();
  if (body.startsWith('<') || body.includes('<html')) return { status: 'offline', score: 0, reason: 'geo_blocked_html' };
  if (!body.startsWith('#EXTM3U')) return { status: 'offline', score: 0, reason: 'not_hls' };

  let mediaUrl = streamUrl, mediaBody = body, variants = [];
  if (body.includes('#EXT-X-STREAM-INF')) {
    const lines = body.split('\n');
    let bestBw = -1, bestVariantUrl = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bw = (lines[i].match(/BANDWIDTH=(\\d+)/) || [])[1];
        const next = lines[i + 1]?.trim();
        if (next && !next.startsWith('#')) {
          const vUrl = resolveUrl(streamUrl, next);
          if (vUrl && parseInt(bw||0) >= bestBw) { bestBw = parseInt(bw||0); bestVariantUrl = vUrl; }
        }
      }
    }
    if (bestVariantUrl) {
      const vRes = await httpGet(bestVariantUrl, customHeaders, false, TIMEOUT);
      if (!vRes.ok) return { status: 'offline', score: 20, reason: 'variant_failed' };
      mediaUrl = bestVariantUrl; mediaBody = vRes.body || '';
    }
  }

  if (!mediaBody.includes('#EXTINF') && !mediaBody.includes('#EXT-X-TARGETDURATION')) {
    return { status: 'offline', score: 0, reason: 'missing_segments' };
  }

  let segRelUrl = null;
  const lines = mediaBody.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('#EXTINF') && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (next && !next.startsWith('#')) { segRelUrl = next; break; }
    }
  }
  if (!segRelUrl) {
    for (const l of lines) {
      const t = l.trim();
      if (t && !t.startsWith('#') && (t.endsWith('.ts') || t.endsWith('.aac') || t.startsWith('http') || t.includes('segment'))) {
        segRelUrl = t; break;
      }
    }
  }
  if (!segRelUrl) return { status: 'offline', score: 20, reason: 'no_segment_found' };

  const segUrl = resolveUrl(mediaUrl, segRelUrl);
  if (!segUrl) return { status: 'offline', score: 0, reason: 'invalid_segment_url' };
  const segRes = await httpGet(segUrl, customHeaders, true, SEG_TIMEOUT);
  const latency = Date.now() - t0;

  if (!segRes.ok) {
    // Manifest was fine — classify as unstable, not offline, so the channel stays visible
    if (segRes.status === 403) return { status: 'unstable', score: 20, reason: 'segment_forbidden' };
    if (segRes.reason === 'timeout') return { status: 'unstable', score: 25, reason: 'segment_timeout' };
    return { status: 'unstable', score: 25, reason: `segment_${segRes.status || segRes.reason || 'failed'}` };
  }

  let score = latency > 8000 ? 40 : latency > 4000 ? 65 : 80;
  return { status: score >= 65 ? 'online' : 'unstable', score, reason: 'stable', latency };
}

async function runScanJob(jobId, options = {}) {
  try {
    const { scope, category_id, language, channel_id } = options;

    let q = `SELECT cs.id, cs.channel_id, cs.stream_url, cs.user_agent, cs.referer, cs.health_status, c.fail_count, c.name as channel_name
             FROM channel_streams cs
             JOIN channels c ON c.id = cs.channel_id
             WHERE c.is_removed = false`;
    const params = [];
    
    if (channel_id) { params.push(channel_id); q += ` AND c.id = $${params.length}`; }
    else {
      if (scope === 'visible') q += ` AND c.is_hidden = false AND c.is_visible_app = true`;
      else if (scope === 'online') q += ` AND cs.health_status = 'online'`;
      else if (scope === 'offline') q += ` AND cs.health_status = 'offline'`;
      else if (scope === 'unstable') q += ` AND cs.health_status = 'unstable'`;
      else if (scope === 'unknown') q += ` AND (cs.health_status IS NULL OR cs.health_status = 'unknown' OR cs.health_status = 'pending_check')`;
      
      if (category_id) { params.push(category_id); q += ` AND c.category_id = $${params.length}`; }
      if (language) { params.push(language); q += ` AND c.language ILIKE $${params.length}`; }
    }
    
    const r = await db.query(q, params);
    const streams = r.rows;
    const total = streams.length;
    
    await db.query('UPDATE stream_scan_jobs SET total_channels=$1, started_at=NOW(), status=$2 WHERE id=$3', [total, 'running', jobId]);

    let completed = 0, failed = 0;
    const CONCURRENCY = 8;
    const logBuffer = [];
    let logFlushPending = false;

    const flushLog = async () => {
      if (logBuffer.length === 0) return;
      const snapshot = logBuffer.splice(0, logBuffer.length);
      await db.query(
        `UPDATE stream_scan_jobs SET channel_log = COALESCE(channel_log, '[]'::jsonb) || $1::jsonb WHERE id=$2`,
        [JSON.stringify(snapshot), jobId]
      );
    };
    
    for (let i = 0; i < streams.length; i += CONCURRENCY) {
      const chunk = streams.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (st) => {
        const hdrs = {};
        if (st.user_agent) hdrs['User-Agent'] = st.user_agent;
        if (st.referer) hdrs['Referer'] = st.referer;
        
        const result = await checkDeep(st.stream_url, hdrs);
        
        // Smart logic: if previously online and now fails, maybe just unstable
        let finalStatus = result.status;
        if (finalStatus === 'offline' && st.health_status === 'online') finalStatus = 'unstable';

        await db.query(
          `UPDATE channel_streams SET
            health_status=$1, health_score=$2, health_reason=$3, last_checked_at=NOW(),
            success_count = CASE WHEN $2 >= 65 THEN success_count+1 ELSE success_count END,
            fail_count    = CASE WHEN $2 <  65 THEN fail_count+1    ELSE fail_count    END,
            last_success_at = CASE WHEN $2 >= 65 THEN NOW() ELSE last_success_at END,
            last_failed_at  = CASE WHEN $2 <  65 THEN NOW() ELSE last_failed_at  END
           WHERE id=$4`,
          [finalStatus, result.score, result.reason, st.id]
        );

        // Update channel status based on best stream
        await db.query(
          `UPDATE channels SET
             health_status = sub.best_status, health_score = sub.best_score, health_reason = sub.best_reason, last_checked_at = NOW(),
             stream_url = CASE WHEN sub.best_status='online' THEN sub.best_url ELSE stream_url END,
             active_stream_id = CASE WHEN sub.best_status='online' THEN sub.best_id ELSE active_stream_id END,
             fail_count = CASE WHEN sub.best_status='offline' THEN COALESCE(fail_count,0)+1 ELSE 0 END,
             last_success_at = CASE WHEN sub.best_status='online' THEN NOW() ELSE last_success_at END,
             last_failure_at = CASE WHEN sub.best_status='offline' THEN NOW() ELSE last_failure_at END,
             status = CASE WHEN sub.best_status='online' THEN 'active' ELSE CASE WHEN status='pending_check' THEN 'offline' ELSE status END END
           FROM (
             SELECT
               CASE WHEN MAX(health_score) >= 65 THEN 'online' WHEN MAX(health_score) > 0 THEN 'unstable' ELSE 'offline' END AS best_status,
               MAX(health_score) AS best_score,
               (SELECT health_reason FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_reason,
               (SELECT stream_url FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_url,
               (SELECT id FROM channel_streams WHERE channel_id=$1 ORDER BY health_score DESC LIMIT 1) AS best_id
             FROM channel_streams WHERE channel_id=$1
           ) sub
           WHERE channels.id=$1`,
          [st.channel_id]
        );

        if (finalStatus === 'online') completed++; else failed++;

        // Append to live log buffer
        logBuffer.push({
          name: st.channel_name || `Channel ${st.channel_id}`,
          status: finalStatus,
          reason: result.reason || '',
          latency: result.latency || null,
          idx: completed + failed,
          total,
        });
      }));

      await Promise.all([
        db.query('UPDATE stream_scan_jobs SET completed_channels=$1, failed_channels=$2 WHERE id=$3', [completed, failed, jobId]),
        flushLog(),
      ]);
    }
    
    await db.query(`UPDATE stream_scan_jobs SET status='completed', completed_at=NOW(), results=$1::jsonb WHERE id=$2`, [JSON.stringify({ total, completed, failed }), jobId]);
  } catch (err) {
    console.error('Job fail:', err);
    try { await db.query(`UPDATE stream_scan_jobs SET status='failed', completed_at=NOW(), results=$1::jsonb WHERE id=$2`, [JSON.stringify({ error: err.message }), jobId]); } catch (_) {}
  }
}

exports.triggerScan = async (req, res) => {
  try {
    await ensureScanJobsTable();
    const { scope = 'all', category_id, language, channel_id } = req.body || {};
    const result = await db.query(
      `INSERT INTO stream_scan_jobs (status, total_channels, completed_channels, failed_channels) VALUES ('pending', 0, 0, 0) RETURNING *`
    );
    const job = result.rows[0];
    success(res, { jobId: job.id, message: 'Scan started' });
    setImmediate(() => runScanJob(job.id, { scope, category_id, language, channel_id }));
  } catch (err) {
    error(res, 'Failed to trigger scan: ' + err.message, 500);
  }
};

exports.getScanStatus = async (req, res) => {
  try {
    await ensureScanJobsTable();
    const { id } = req.params;
    const result = await db.query('SELECT * FROM stream_scan_jobs WHERE id=$1', [id]);
    if (result.rows.length === 0) return error(res, 'Job not found', 404);
    success(res, result.rows[0]);
  } catch (err) { error(res, 'Failed to fetch scan status', 500); }
};

exports.getScanHistory = async (req, res) => {
  try {
    await ensureScanJobsTable();
    const result = await db.query('SELECT * FROM stream_scan_jobs ORDER BY created_at DESC LIMIT 50');
    success(res, result.rows);
  } catch (err) { error(res, 'Failed to fetch scan history', 500); }
};

exports.checkDeep = checkDeep;

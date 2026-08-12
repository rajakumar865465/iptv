/**
 * Stream Health Checker - Fixed Version
 * - HEAD requests first; fallback to GET with Range: bytes=0-2048
 * - HLS detection: checks #EXTM3U in body OR URL ends with .m3u8
 * - Parallel checking with concurrency limit of 10
 * - Saves last_checked_at on every check
 * Usage: node scripts/check-streams.js
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../src/config/db');

const REQUEST_TIMEOUT = 12000;
const CONCURRENCY = 10;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36';

/**
 * Makes an HTTP/HTTPS request and returns status, headers, and partial body.
 */
function makeRequest(url, method, headers = {}) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve({ ok: false, error: 'invalid_url' }); }
    const client = parsed.protocol === 'https:' ? https : http;

    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || USER_AGENT,
      ...(headers['Referer'] ? { 'Referer': headers['Referer'] } : {}),
    };
    if (method === 'GET') reqHeaders['Range'] = 'bytes=0-2048';

    // Hard timeout to prevent DNS/OS level hanging
    const timeoutId = setTimeout(() => {
      resolve({ ok: false, error: 'hard_timeout' });
    }, REQUEST_TIMEOUT + 2000);

    const cleanup = () => clearTimeout(timeoutId);

    const req = client.request(url, {
      method,
      timeout: REQUEST_TIMEOUT,
      headers: reqHeaders,
    }, (res) => {
      const status = res.statusCode;
      const contentType = res.headers['content-type'] || '';

      let body = '';
      if (method === 'GET') {
        res.setEncoding('utf8');
        res.on('data', chunk => {
          body += chunk;
          if (body.length > 2048) res.destroy();
        });
        res.on('end', () => {
          cleanup();
          resolve({ ok: status >= 200 && status < 400, status, contentType, body });
        });
        res.on('error', () => {
          cleanup();
          resolve({ ok: false, error: 'response_error' });
        });
      } else {
        res.resume();
        cleanup();
        resolve({ ok: status >= 200 && status < 400, status, contentType, body: '' });
      }
    });

    req.on('error', () => { cleanup(); resolve({ ok: false, error: 'request_error' }); });
    req.on('timeout', () => { req.destroy(); cleanup(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

/**
 * Check if a stream URL is working and HLS.
 * Step 1: HEAD request
 * Step 2 (if HEAD fails): GET with Range header, inspect body
 */
async function checkStream(url, customHeaders = {}) {
  if (!url || url.trim() === '') return { ok: false, error: 'empty_url' };

  // Step 1: HEAD
  const headResult = await makeRequest(url, 'HEAD', customHeaders);
  if (headResult.ok) {
    const ct = headResult.contentType.toLowerCase();
    const isHLS = ct.includes('mpegurl') || ct.includes('m3u') || url.toLowerCase().endsWith('.m3u8');
    if (isHLS) return { ok: true, method: 'HEAD' };
    // HEAD succeeded but no clear HLS content-type: fall through to GET for body check
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
                body.includes('#EXT-X-VERSION') ||
                body.includes('#EXT-X-STREAM-INF') ||
                body.includes('#EXT-X-TARGETDURATION') ||
                ct.includes('octet-stream') ||
                ct.includes('video/');

  return { ok: isHLS, method: 'GET', isHLS };
}

/**
 * Process channels in batches of CONCURRENCY
 */
async function runWithConcurrency(items, fn, limit) {
  const results = [];
  let i = 0;
  while (i < items.length) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    i += limit;
  }
  return results;
}

async function checkAllStreams() {
  console.log('=== Stream Health Checker ===');

  const { rows: channels } = await db.query(
    `SELECT id, name, stream_url, backup_stream_url, user_agent, referrer
     FROM channels
     WHERE status IN ('active', 'disabled')
     AND stream_url IS NOT NULL AND stream_url != ''
     ORDER BY id ASC`
  );

  console.log(`Found ${channels.length} channels to check.\n`);

  let activeCount = 0;
  let disabledCount = 0;

  await runWithConcurrency(channels, async (ch) => {
    const headers = {};
    if (ch.user_agent) headers['User-Agent'] = ch.user_agent;
    if (ch.referrer) headers['Referer'] = ch.referrer;

    let result = await checkStream(ch.stream_url, headers);

    // Try backup URL if main fails
    if (!result.ok && ch.backup_stream_url && ch.backup_stream_url.trim()) {
      const backupResult = await checkStream(ch.backup_stream_url, headers);
      if (backupResult.ok) {
        result = backupResult;
        // Promote backup to main
        await db.query(
          `UPDATE channels SET stream_url = $1, backup_stream_url = NULL WHERE id = $2`,
          [ch.backup_stream_url, ch.id]
        );
      }
    }

    const healthStatus = result.ok ? 'online' : 'offline';
    await db.query(
      `UPDATE channels SET health_status = $1, last_checked_at = NOW() WHERE id = $2`,
      [healthStatus, ch.id]
    );

    if (result.ok) activeCount++; else disabledCount++;
    const icon = result.ok ? '✓' : '✗';
    const errInfo = result.ok ? '' : ` (${result.error || 'no_hls'})`;
    console.log(`${icon} [${ch.id}] ${ch.name}${errInfo}`);
  }, CONCURRENCY);

  console.log(`\n=== Check Complete ===`);
  console.log(`  Active:   ${activeCount}`);
  console.log(`  Disabled: ${disabledCount}`);
  console.log(`  Total:    ${channels.length}`);

  await db.pool.end();
  process.exit(0);
}

checkAllStreams().catch(err => {
  console.error('Stream check failed:', err);
  process.exit(1);
});

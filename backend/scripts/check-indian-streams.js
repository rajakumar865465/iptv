/**
 * Targeted Stream Health Checker for Indian Channels
 * - Only checks channels with is_visible_app = true
 * - Checks backup streams from channel_streams if primary is dead
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../src/config/db');

const REQUEST_TIMEOUT = 10000;
const CONCURRENCY = 15;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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
        res.on('end', () => resolve({ ok: status >= 200 && status < 400, status, contentType, body }));
        res.on('error', () => resolve({ ok: false, error: 'response_error' }));
      } else {
        res.resume();
        resolve({ ok: status >= 200 && status < 400, status, contentType, body: '' });
      }
    });

    req.on('error', () => resolve({ ok: false, error: 'request_error' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

async function checkStream(url, customHeaders = {}) {
  if (!url || url.trim() === '') return { ok: false, error: 'empty_url' };

  const headResult = await makeRequest(url, 'HEAD', customHeaders);
  if (headResult.ok) {
    const ct = headResult.contentType.toLowerCase();
    const isHLS = ct.includes('mpegurl') || ct.includes('m3u') || url.toLowerCase().endsWith('.m3u8');
    if (isHLS) return { ok: true, method: 'HEAD' };
  }

  const getResult = await makeRequest(url, 'GET', customHeaders);
  if (!getResult.ok) return { ok: false, error: getResult.error || `HTTP_${getResult.status}` };

  const ct = (getResult.contentType || '').toLowerCase();
  const body = getResult.body || '';
  const isHLS = ct.includes('mpegurl') || ct.includes('m3u') ||
                url.toLowerCase().endsWith('.m3u8') ||
                body.trimStart().startsWith('#EXTM3U');

  return { ok: isHLS, method: 'GET', isHLS };
}

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

async function checkIndianStreams() {
  console.log('=== Indian Streams Health Checker ===');

  const { rows: channels } = await db.query(
    `SELECT id, name, stream_url, user_agent, referrer
     FROM channels
     WHERE status = 'active' AND is_visible_app = true
     ORDER BY id ASC`
  );

  console.log(`Found ${channels.length} visible Indian channels to check.\n`);

  let activeCount = 0;
  let offlineCount = 0;
  let fixedCount = 0;

  await runWithConcurrency(channels, async (ch) => {
    const headers = {};
    if (ch.user_agent) headers['User-Agent'] = ch.user_agent;
    if (ch.referrer) headers['Referer'] = ch.referrer;

    let result = await checkStream(ch.stream_url, headers);
    let finalUrl = ch.stream_url;

    // If main stream fails, try backup streams
    if (!result.ok) {
      const { rows: backups } = await db.query(
        `SELECT stream_url FROM channel_streams WHERE channel_id = $1 AND stream_url != $2 ORDER BY priority DESC`,
        [ch.id, ch.stream_url]
      );
      
      for (const backup of backups) {
        const backupResult = await checkStream(backup.stream_url, headers);
        if (backupResult.ok) {
          result = backupResult;
          finalUrl = backup.stream_url;
          // Promote backup to main
          await db.query(
            `UPDATE channels SET stream_url = $1 WHERE id = $2`,
            [finalUrl, ch.id]
          );
          fixedCount++;
          break;
        }
      }
    }

    const healthStatus = result.ok ? 'online' : 'offline';
    await db.query(
      `UPDATE channels SET health_status = $1, last_checked_at = NOW() WHERE id = $2`,
      [healthStatus, ch.id]
    );

    if (result.ok) activeCount++; else offlineCount++;
    console.log(`${result.ok ? '✓' : '✗'} [${ch.id}] ${ch.name}`);
  }, CONCURRENCY);

  console.log(`\n=== Check Complete ===`);
  console.log(`  Online:   ${activeCount}`);
  console.log(`  Offline:  ${offlineCount}`);
  console.log(`  Fixed via Backup: ${fixedCount}`);
}

async function main() {
  try {
    await checkIndianStreams();
  } catch (err) {
    console.error('Error during stream check:', err);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

module.exports = { checkIndianStreams };

if (require.main === module) {
  main();
}

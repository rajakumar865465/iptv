'use strict';
/**
 * channelImportScanner.js
 *
 * Runs the async scan phase of a channel_import_session:
 *   - checks each item's stream health (reusing the deep HLS scanner)
 *   - checks each item against the live `channels` table for duplicates
 *   - never touches `channels` — only channel_import_items
 *
 * Uses a bounded worker pool instead of firing all requests at once, so a
 * 500-channel M3U doesn't create 500 simultaneous outbound sockets.
 */

const db = require('../config/db');
const { checkDeep } = require('../controllers/scannerController');

const CONCURRENCY = 12;

function normalizeUrlForCompare(url) {
  return (url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Checks a single import item against the live `channels` table.
 * Returns { dbStatus, duplicateOfChannelId, duplicateReason }.
 */
async function findDuplicate(item) {
  const { rows } = await db.query(
    `SELECT id, name, stream_url, tvg_id, canonical_name
     FROM channels
     WHERE is_removed IS NOT TRUE
       AND (
         stream_url = $1
         OR (COALESCE($2, '') <> '' AND tvg_id = $2)
         OR (COALESCE($3, '') <> '' AND canonical_name = $3)
         OR RTRIM(REGEXP_REPLACE(LOWER(stream_url), '^https?://', ''), '/') =
            RTRIM(REGEXP_REPLACE(LOWER($1), '^https?://', ''), '/')
       )
     LIMIT 1`,
    [item.stream_url, item.tvg_id || '', item.name_normalized || '']
  );

  if (!rows.length) return { dbStatus: 'new', duplicateOfChannelId: null, duplicateReason: null };

  const match = rows[0];
  let reason = 'normalized_url';
  if (match.stream_url === item.stream_url) reason = 'exact_stream_url';
  else if (item.tvg_id && match.tvg_id === item.tvg_id) reason = 'tvg_id';
  else if (item.name_normalized && match.canonical_name === item.name_normalized) reason = 'normalized_name';

  return { dbStatus: 'duplicate', duplicateOfChannelId: match.id, duplicateReason: reason };
}

async function scanItem(item) {
  const headers = {};
  if (item.user_agent) headers['User-Agent'] = item.user_agent;
  if (item.referer) headers['Referer'] = item.referer;

  const t0 = Date.now();
  let healthResult;
  try {
    healthResult = await checkDeep(item.stream_url, headers);
  } catch (err) {
    healthResult = { status: 'unknown', score: 0, reason: `scan_error: ${err.message}` };
  }
  const responseTime = healthResult.latency || (Date.now() - t0);

  let dupResult;
  try {
    dupResult = await findDuplicate(item);
  } catch (err) {
    dupResult = { dbStatus: 'unknown', duplicateOfChannelId: null, duplicateReason: null };
  }

  return { healthResult, responseTime, dupResult };
}

async function runScanSession(sessionId) {
  try {
    await db.query(
      `UPDATE channel_import_sessions SET status = 'scanning', started_at = NOW() WHERE id = $1`,
      [sessionId]
    );

    const { rows: items } = await db.query(
      `SELECT * FROM channel_import_items WHERE session_id = $1 AND status = 'pending' ORDER BY id ASC`,
      [sessionId]
    );

    let online = 0, offline = 0, unstable = 0, unknown = 0, duplicate = 0, fresh = 0, checked = 0;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (item) => {
          await db.query(`UPDATE channel_import_items SET status = 'checking' WHERE id = $1`, [item.id]);

          const { healthResult, responseTime, dupResult } = await scanItem(item);

          const status = ['online', 'offline', 'unstable'].includes(healthResult.status)
            ? healthResult.status
            : 'unknown';

          await db.query(
            `UPDATE channel_import_items SET
               status = $1,
               response_time_ms = $2,
               health_reason = $3,
               db_status = $4,
               duplicate_of_channel_id = $5,
               duplicate_reason = $6,
               checked_at = NOW()
             WHERE id = $7`,
            [
              status,
              responseTime || null,
              healthResult.reason || null,
              dupResult.dbStatus,
              dupResult.duplicateOfChannelId,
              dupResult.duplicateReason,
              item.id,
            ]
          );

          if (status === 'online') online++;
          else if (status === 'offline') offline++;
          else if (status === 'unstable') unstable++;
          else unknown++;

          if (dupResult.dbStatus === 'duplicate') duplicate++;
          else fresh++;

          checked++;
        })
      );

      await db.query(
        `UPDATE channel_import_sessions SET
           total_checked = $1, total_online = $2, total_offline = $3,
           total_unstable = $4, total_unknown = $5, total_duplicate = $6, total_new = $7
         WHERE id = $8`,
        [checked, online, offline, unstable, unknown, duplicate, fresh, sessionId]
      );
    }

    await db.query(
      `UPDATE channel_import_sessions SET status = 'scanned', scanned_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  } catch (err) {
    console.error(`[ChannelImportScanner] Session ${sessionId} failed:`, err);
    await db.query(
      `UPDATE channel_import_sessions SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message, sessionId]
    ).catch(() => {});
  }
}

module.exports = { runScanSession, findDuplicate };

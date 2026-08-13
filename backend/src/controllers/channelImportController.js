'use strict';
/**
 * channelImportController.js
 *
 * "M3U Channel Importer & Stream Health Scanner"
 *
 * Flow: fetch/paste M3U -> parse into a staging session -> scan (health +
 * duplicate detection) -> admin reviews/selects -> import selected items into
 * `channels`. Nothing is written to `channels` until the final import step,
 * and that step re-checks for duplicates at commit time so two concurrent
 * imports can't both insert the same channel.
 */

const db = require('../config/db');
const { success, error } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');
const { safeFetch } = require('../utils/ssrfGuard');
const { parseM3u } = require('../utils/m3uParser');
const { runScanSession } = require('../jobs/channelImportScanner');

const MAX_M3U_BYTES = 15 * 1024 * 1024; // 15MB safety cap on fetched playlists

// --- FETCH RAW M3U FROM URL (preview only, does not create a session) ---
exports.fetchM3u = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') return error(res, 'url is required', 400);

    const res2 = await safeFetch(url, { timeoutMs: 15000 });
    if (!res2.ok) return error(res, `Failed to fetch M3U (HTTP ${res2.status})`, 502);

    const text = await res2.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_M3U_BYTES) {
      return error(res, 'M3U file is too large', 413);
    }

    success(res, { content: text, size: Buffer.byteLength(text, 'utf8') });
  } catch (err) {
    console.error('[ChannelImport] fetchM3u error:', err);
    error(res, `Failed to fetch M3U: ${err.message}`, 400);
  }
};

// --- PARSE M3U CONTENT (from URL or pasted text) INTO A NEW IMPORT SESSION ---
exports.parseAndCreateSession = async (req, res) => {
  try {
    const { source_type, source_url, content, source_label, language, country, source_name } = req.body;
    const adminId = req.user.id;

    let rawContent = content;
    if (source_type === 'url') {
      if (!source_url) return error(res, 'source_url is required', 400);
      const fetchRes = await safeFetch(source_url, { timeoutMs: 15000 });
      if (!fetchRes.ok) return error(res, `Failed to fetch M3U (HTTP ${fetchRes.status})`, 502);
      rawContent = await fetchRes.text();
      if (Buffer.byteLength(rawContent, 'utf8') > MAX_M3U_BYTES) {
        return error(res, 'M3U file is too large', 413);
      }
    }

    if (!rawContent || !rawContent.trim()) {
      return error(res, 'No M3U content to parse', 400);
    }

    const defaults = { language, country, source: source_name || 'm3u-import' };
    let items;
    try {
      items = parseM3u(rawContent, defaults);
    } catch (parseErr) {
      return error(res, `Failed to parse M3U: ${parseErr.message}`, 400);
    }

    if (!items.length) {
      return error(res, 'No valid channels found in the M3U content', 400);
    }

    const sessionRes = await db.query(
      `INSERT INTO channel_import_sessions
         (admin_id, source_type, source_url, source_label, default_language, default_country, status, total_found)
       VALUES ($1, $2, $3, $4, $5, $6, 'parsed', $7)
       RETURNING *`,
      [adminId, source_type === 'url' ? 'url' : 'text', source_url || null, source_label || null, language || null, country || null, items.length]
    );
    const session = sessionRes.rows[0];

    // Bulk insert items
    const values = [];
    const params = [];
    let p = 1;
    for (const it of items) {
      values.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`
      );
      params.push(
        session.id,
        it.channel_name,
        it.name_normalized,
        it.tvg_id,
        it.tvg_name,
        it.tvg_logo,
        it.group_title,
        it.language,
        it.country,
        it.source,
        it.stream_url,
        it.stream_url_normalized,
        it.user_agent
      );
    }

    await db.query(
      `INSERT INTO channel_import_items
         (session_id, channel_name, name_normalized, tvg_id, tvg_name, tvg_logo, group_title, language, country, source, stream_url, stream_url_normalized, user_agent)
       VALUES ${values.join(', ')}`,
      params
    );

    await logAudit({
      admin_id: adminId, action: 'channel_import_session_created', target_type: 'channel_import_session', target_id: session.id,
      new_value: { source_type, source_url, total_found: items.length },
      ip_address: req.ip, user_agent: req.get('User-Agent'),
    });

    success(res, { session_id: session.id, total_found: items.length }, 'Parsed successfully');
  } catch (err) {
    console.error('[ChannelImport] parseAndCreateSession error:', err);
    error(res, `Failed to parse M3U: ${err.message}`, 500);
  }
};

// --- START ASYNC SCAN (health + duplicate check) FOR A SESSION ---
exports.startScan = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionRes = await db.query('SELECT * FROM channel_import_sessions WHERE id = $1', [id]);
    if (!sessionRes.rows.length) return error(res, 'Session not found', 404);
    const session = sessionRes.rows[0];

    if (session.status === 'scanning') {
      return success(res, { session_id: session.id }, 'Scan already running');
    }

    success(res, { session_id: session.id }, 'Scan started');
    setImmediate(() => runScanSession(session.id).catch((e) => console.error('Scan job crashed:', e)));
  } catch (err) {
    error(res, 'Failed to start scan', 500);
  }
};

// --- GET SESSION (progress/summary) ---
exports.getSession = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM channel_import_sessions WHERE id = $1', [id]);
    if (!result.rows.length) return error(res, 'Session not found', 404);
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch session', 500);
  }
};

// --- LIST SESSIONS (import history) ---
exports.listSessions = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM channel_import_sessions ORDER BY created_at DESC LIMIT 50`
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch import history', 500);
  }
};

// --- LIST ITEMS FOR A SESSION (with filters) ---
exports.getSessionItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, db_status, search, group_title, language, page = 1, limit = 200, sort = 'id_asc' } = req.query;

    const where = ['session_id = $1'];
    const params = [id];
    let p = 2;

    if (status && status !== 'all') { where.push(`status = $${p++}`); params.push(status); }
    if (db_status && db_status !== 'all') { where.push(`db_status = $${p++}`); params.push(db_status); }
    if (group_title) { where.push(`group_title = $${p++}`); params.push(group_title); }
    if (language) { where.push(`language = $${p++}`); params.push(language); }
    if (search) { where.push(`channel_name ILIKE $${p++}`); params.push(`%${search}%`); }

    const sortMap = {
      id_asc: 'id ASC',
      name_asc: 'channel_name ASC',
      status: `CASE status WHEN 'online' THEN 1 WHEN 'unstable' THEN 2 WHEN 'unknown' THEN 3 WHEN 'offline' THEN 4 ELSE 5 END ASC`,
      response_time: 'response_time_ms ASC NULLS LAST',
    };
    const orderBy = sortMap[sort] || sortMap.id_asc;

    const limitNum = Math.min(parseInt(limit, 10) || 200, 500);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitNum;

    params.push(limitNum, offset);
    const itemsRes = await db.query(
      `SELECT * FROM channel_import_items WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    const countRes = await db.query(
      `SELECT COUNT(*) FROM channel_import_items WHERE ${where.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );

    success(res, { items: itemsRes.rows, total: parseInt(countRes.rows[0].count, 10) });
  } catch (err) {
    console.error('[ChannelImport] getSessionItems error:', err);
    error(res, 'Failed to fetch items', 500);
  }
};

// --- CANCEL SESSION ---
exports.cancelSession = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE channel_import_sessions SET status = 'cancelled' WHERE id = $1 AND status NOT IN ('completed')`,
      [id]
    );
    success(res, null, 'Session cancelled');
  } catch (err) {
    error(res, 'Failed to cancel session', 500);
  }
};

// --- IMPORT SELECTED ITEMS INTO channels (transaction-safe, re-checks dupes) ---
exports.importSelected = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { itemIds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(itemIds) || !itemIds.length) {
      return error(res, 'itemIds must be a non-empty array', 400);
    }

    const sessionRes = await client.query('SELECT * FROM channel_import_sessions WHERE id = $1', [id]);
    if (!sessionRes.rows.length) return error(res, 'Session not found', 404);

    await client.query('BEGIN');
    await client.query(`UPDATE channel_import_sessions SET status = 'importing' WHERE id = $1`, [id]);

    const summary = { imported: 0, skippedDuplicate: 0, skippedOther: 0 };

    // Dynamically fetch categories for mapping
    const categoriesRes = await client.query('SELECT id, name FROM categories');
    const categoryMap = {};
    let fallbackCatId = null;
    categoriesRes.rows.forEach(r => {
      categoryMap[r.name.toLowerCase()] = r.id;
      if (r.name.toLowerCase() === 'general' || r.name.toLowerCase() === 'unknown') {
        fallbackCatId = r.id;
      }
    });
    if (!fallbackCatId && categoriesRes.rows.length > 0) {
      fallbackCatId = categoriesRes.rows[0].id;
    }
    if (!fallbackCatId) {
      const newCatRes = await client.query("INSERT INTO categories (name, status) VALUES ('General', 'active') RETURNING id");
      fallbackCatId = newCatRes.rows[0].id;
    }

    for (const itemId of itemIds) {
      const itemRes = await client.query(
        'SELECT * FROM channel_import_items WHERE id = $1 AND session_id = $2',
        [itemId, id]
      );
      if (!itemRes.rows.length) { summary.skippedOther++; continue; }
      const item = itemRes.rows[0];

      if (item.import_status === 'imported') { continue; } // already imported, idempotent

      // Serialize concurrent imports of the same logical channel via an
      // advisory lock scoped to this transaction (released on COMMIT/ROLLBACK).
      const lockKey = item.name_normalized || item.stream_url_normalized || item.stream_url;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

      // Re-check for duplicates at the moment of insertion — the frontend's
      // earlier scan result may now be stale if another import ran meanwhile.
      const dupCheck = await client.query(
        `SELECT id FROM channels
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

      if (dupCheck.rows.length) {
        await client.query(
          `UPDATE channel_import_items SET import_status = 'skipped_duplicate', duplicate_of_channel_id = $1 WHERE id = $2`,
          [dupCheck.rows[0].id, item.id]
        );
        summary.skippedDuplicate++;
        continue;
      }

      let categoryId = fallbackCatId;
      if (item.group_title) {
        const gt = item.group_title.toLowerCase();
        if (categoryMap[gt]) {
          categoryId = categoryMap[gt];
        } else {
          for (const [name, cId] of Object.entries(categoryMap)) {
            if (gt.includes(name) || name.includes(gt)) {
              categoryId = cId;
              break;
            }
          }
        }
      }

      const insertRes = await client.query(
        `INSERT INTO channels
           (name, display_name, canonical_name, tvg_id, logo_url, category_id, language, country, source, status, stream_url, user_agent, referrer)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11)
         RETURNING id`,
        [
          item.channel_name,
          item.name_normalized,
          item.tvg_id || null,
          item.tvg_logo || null,
          categoryId,
          item.language || null,
          item.country || null,
          item.source || 'm3u-import',
          item.stream_url,
          item.user_agent || null,
          item.referer || null,
        ]
      );
      const newChannelId = insertRes.rows[0].id;

      await client.query(
        `INSERT INTO channel_streams (channel_id, stream_url, user_agent, referer, source_name, is_primary)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [newChannelId, item.stream_url, item.user_agent || null, item.referer || null, item.source || 'm3u-import']
      );

      await client.query(
        `UPDATE channel_import_items SET import_status = 'imported', imported_channel_id = $1 WHERE id = $2`,
        [newChannelId, item.id]
      );
      summary.imported++;
    }

    await client.query(
      `UPDATE channel_import_sessions SET
         status = 'completed', completed_at = NOW(),
         total_imported = total_imported + $1, total_skipped = total_skipped + $2
       WHERE id = $3`,
      [summary.imported, summary.skippedDuplicate + summary.skippedOther, id]
    );

    await client.query('COMMIT');

    await logAudit({
      admin_id: adminId, action: 'channel_import_completed', target_type: 'channel_import_session', target_id: id,
      new_value: summary, ip_address: req.ip, user_agent: req.get('User-Agent'),
    });

    success(res, summary, `Imported ${summary.imported} channels`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ChannelImport] importSelected error:', err);
    error(res, `Failed to import channels: ${err.message}`, 500);
  } finally {
    client.release();
  }
};

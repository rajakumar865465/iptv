'use strict';
/**
 * scannerController.js
 * Probes stream URLs and updates health_status.
 * Falls back to scanning channels.stream_url if channel_streams table doesn't exist.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../config/db');
const { success, error } = require('../utils/response');

// ── Ensure the scan jobs table exists ─────────────────────────────────────────
async function ensureScanJobsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stream_scan_jobs (
      id                 SERIAL PRIMARY KEY,
      status             VARCHAR(20) DEFAULT 'pending',
      total_channels     INTEGER DEFAULT 0,
      completed_channels INTEGER DEFAULT 0,
      failed_channels    INTEGER DEFAULT 0,
      results            JSONB,
      started_at         TIMESTAMP,
      completed_at       TIMESTAMP,
      created_at         TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ── Probe a single URL with 10-second timeout ─────────────────────────────────
function probeUrl(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (_) {
      return resolve({ ok: false, status: null, reason: 'invalid_url' });
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
      res.resume();
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      resolve({ ok, status: res.statusCode, reason: ok ? null : `http_${res.statusCode}` });
    });
    req.on('error', (e) => resolve({ ok: false, status: null, reason: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null, reason: 'timeout' }); });
    req.end();
  });
}

// ── Check if a table/column exists ───────────────────────────────────────────
async function tableExists(tableName) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  return r.rows.length > 0;
}

async function columnExists(tableName, colName) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [tableName, colName]
  );
  return r.rows.length > 0;
}

// ── Background scan job ───────────────────────────────────────────────────────
async function runScanJob(jobId, scope, categoryId) {
  try {
    const hasStreamsTable = await tableExists('channel_streams');
    const hasHealthReason = hasStreamsTable && await columnExists('channel_streams', 'health_reason');

    let streams = [];

    if (hasStreamsTable) {
      // Use channel_streams table
      let q = `SELECT cs.id, cs.channel_id, cs.stream_url, 'stream' as src
               FROM channel_streams cs
               JOIN channels c ON c.id = cs.channel_id
               WHERE c.status = 'active'`;
      const params = [];
      if (scope === 'offline') q += ` AND cs.health_status = 'offline'`;
      else if (scope === 'unknown') q += ` AND (cs.health_status IS NULL OR cs.health_status = 'unknown')`;
      if (categoryId) { params.push(categoryId); q += ` AND c.category_id = $${params.length}`; }
      q += ' ORDER BY cs.channel_id, cs.priority ASC';
      const r = await db.query(q, params);
      streams = r.rows;
    }

    // Fallback: scan channels.stream_url directly if no streams table or no rows
    if (streams.length === 0) {
      let q = `SELECT id as channel_id, stream_url, id, 'channel' as src
               FROM channels WHERE status = 'active' AND stream_url IS NOT NULL AND stream_url != ''`;
      const params = [];
      if (categoryId) { params.push(categoryId); q += ` AND category_id = $${params.length}`; }
      const r = await db.query(q, params);
      streams = r.rows;
    }

    const total = streams.length;
    await db.query(
      'UPDATE stream_scan_jobs SET total_channels=$1, started_at=NOW(), status=$2 WHERE id=$3',
      [total, 'running', jobId]
    );

    let completed = 0;
    let failed = 0;
    const CONCURRENCY = 8;

    for (let i = 0; i < streams.length; i += CONCURRENCY) {
      const chunk = streams.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (stream) => {
        const probe = await probeUrl(stream.stream_url);
        const newStatus = probe.ok ? 'online' : (probe.reason === 'timeout' ? 'unstable' : 'offline');

        const scoreDelta = probe.ok ? 10 : (probe.reason === 'timeout' ? -10 : -20);

        if (stream.src === 'stream' && hasStreamsTable) {
          // Update channel_streams row
          if (hasHealthReason) {
            await db.query(
              `UPDATE channel_streams
               SET health_status=$1, last_checked_at=NOW(), health_reason=$2,
                   health_score = GREATEST(0, LEAST(100, health_score + $4::int))
               WHERE id=$3`,
              [newStatus, probe.reason, stream.id, scoreDelta]
            );
          } else {
            await db.query(
              `UPDATE channel_streams
               SET health_status=$1, last_checked_at=NOW(),
                   health_score = GREATEST(0, LEAST(100, health_score + $3::int))
               WHERE id=$2`,
              [newStatus, stream.id, scoreDelta]
            );
          }
          // Mirror to channels table
          await db.query(
            `UPDATE channels SET health_status=$1, last_checked_at=NOW()
             WHERE id=$2 AND (active_stream_id=$3 OR active_stream_id IS NULL)`,
            [newStatus, stream.channel_id, stream.id]
          );
        } else {
          // Fallback: update channels.health_status directly
          await db.query(
            `UPDATE channels SET health_status=$1, last_checked_at=NOW() WHERE id=$2`,
            [newStatus, stream.channel_id]
          );
        }

        if (probe.ok) { completed++; } else { failed++; }
      }));

      await db.query(
        'UPDATE stream_scan_jobs SET completed_channels=$1, failed_channels=$2 WHERE id=$3',
        [completed, failed, jobId]
      );
    }

    await db.query(
      `UPDATE stream_scan_jobs SET status='completed', completed_at=NOW(), results=$1::jsonb WHERE id=$2`,
      [JSON.stringify({ total, completed, failed }), jobId]
    );
  } catch (err) {
    console.error('[Scanner] Job failed:', err.message);
    try {
      await db.query(
        `UPDATE stream_scan_jobs SET status='failed', completed_at=NOW(), results=$1::jsonb WHERE id=$2`,
        [JSON.stringify({ error: err.message }), jobId]
      );
    } catch (_) {}
  }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

exports.triggerScan = async (req, res) => {
  try {
    await ensureScanJobsTable();
    const { scope = 'all', category_id } = req.body || {};

    const result = await db.query(
      `INSERT INTO stream_scan_jobs (status, total_channels, completed_channels, failed_channels)
       VALUES ('pending', 0, 0, 0) RETURNING *`
    );
    const job = result.rows[0];

    success(res, {
      jobId: job.id,
      message: `Scan started (scope=${scope}). Poll GET /scanner/${job.id} for progress.`,
    });

    setImmediate(() => runScanJob(job.id, scope, category_id || null));
  } catch (err) {
    console.error('triggerScan error:', err);
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
  } catch (err) {
    error(res, 'Failed to fetch scan status', 500);
  }
};

exports.getScanHistory = async (req, res) => {
  try {
    await ensureScanJobsTable();
    const result = await db.query('SELECT * FROM stream_scan_jobs ORDER BY created_at DESC LIMIT 50');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch scan history', 500);
  }
};

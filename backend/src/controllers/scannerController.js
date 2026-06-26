'use strict';
/**
 * scannerController.js
 *
 * BUG-06 / MISSING-01 FIX: The scanner now actually probes stream URLs instead of
 * just inserting a placeholder job record. It sends an HTTP HEAD (falling back to GET)
 * to each stream URL and updates health_status based on the response.
 *
 * Runs asynchronously — responds immediately with a jobId, then probes in the background.
 * Poll GET /scanner/:id for live progress updates.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../config/db');
const { success, error } = require('../utils/response');

// ── Probe a single stream URL with a 10-second timeout ───────────────────────
function probeUrl(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (_) { return resolve({ ok: false, status: null, reason: 'invalid_url' }); }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
      res.resume(); // drain
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      resolve({ ok, status: res.statusCode, reason: ok ? null : `http_${res.statusCode}` });
    });
    req.on('error', (e) => resolve({ ok: false, status: null, reason: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null, reason: 'timeout' }); });
    req.end();
  });
}

// ── Background scanner job ────────────────────────────────────────────────────
async function runScanJob(jobId, scope, categoryId) {
  try {
    // Build the list of streams to probe
    let streamQuery = `SELECT cs.id, cs.channel_id, cs.stream_url
                       FROM channel_streams cs
                       JOIN channels c ON c.id = cs.channel_id
                       WHERE c.status = 'active'`;
    const qParams = [];
    if (scope === 'offline') {
      streamQuery += ` AND cs.health_status = 'offline'`;
    } else if (scope === 'unknown') {
      streamQuery += ` AND (cs.health_status IS NULL OR cs.health_status = 'unknown')`;
    }
    if (categoryId) {
      qParams.push(categoryId);
      streamQuery += ` AND c.category_id = $${qParams.length}`;
    }
    streamQuery += ' ORDER BY cs.channel_id, cs.priority ASC';

    const { rows: streams } = await db.query(streamQuery, qParams);
    const total = streams.length;

    // Update job total
    await db.query('UPDATE stream_scan_jobs SET total_channels = $1, started_at = NOW() WHERE id = $2', [total, jobId]);

    let completed = 0;
    let failed = 0;
    const CONCURRENCY = 8;

    // Process in chunks for bounded concurrency
    for (let i = 0; i < streams.length; i += CONCURRENCY) {
      const chunk = streams.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (stream) => {
        const probe = await probeUrl(stream.stream_url);
        const newStatus = probe.ok ? 'online' : (probe.reason === 'timeout' ? 'unstable' : 'offline');

        await db.query(
          `UPDATE channel_streams
           SET health_status = $1, last_checked_at = NOW(),
               health_reason  = $2,
               health_score   = CASE WHEN $1 = 'online'   THEN LEAST(100, health_score + 10)
                                     WHEN $1 = 'unstable' THEN GREATEST(0,  health_score - 10)
                                     ELSE                      GREATEST(0,  health_score - 20)
                                END
           WHERE id = $3`,
          [newStatus, probe.reason, stream.id]
        );

        // Mirror status to channels table for the primary stream
        await db.query(
          `UPDATE channels SET health_status = $1, last_checked_at = NOW()
           WHERE id = $2 AND (active_stream_id = $3 OR active_stream_id IS NULL)`,
          [newStatus, stream.channel_id, stream.id]
        );

        if (probe.ok) { completed++; } else { failed++; }
      }));

      // Update progress after each chunk
      await db.query(
        'UPDATE stream_scan_jobs SET completed_channels = $1, failed_channels = $2 WHERE id = $3',
        [completed, failed, jobId]
      );
    }

    await db.query(
      `UPDATE stream_scan_jobs SET status = 'completed', completed_at = NOW(),
         results = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ total, completed, failed }), jobId]
    );
  } catch (err) {
    console.error('[Scanner] Job failed:', err.message);
    await db.query(
      `UPDATE stream_scan_jobs SET status = 'failed', completed_at = NOW(),
         results = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ error: err.message }), jobId]
    );
  }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

exports.triggerScan = async (req, res) => {
  try {
    const { scope = 'all', category_id } = req.body;

    const result = await db.query(
      `INSERT INTO stream_scan_jobs (status, total_channels, completed_channels, failed_channels)
       VALUES ('pending', 0, 0, 0) RETURNING *`,
      []
    );
    const job = result.rows[0];

    // Respond immediately; scan runs in background
    success(res, {
      jobId: job.id,
      message: `Scan started (scope=${scope}). Poll GET /scanner/${job.id} for progress.`,
    });

    // Fire-and-forget
    setImmediate(() => runScanJob(job.id, scope, category_id || null));
  } catch (err) {
    error(res, 'Failed to trigger scan', 500);
  }
};

exports.getScanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM stream_scan_jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) return error(res, 'Job not found', 404);
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch scan status', 500);
  }
};

exports.getScanHistory = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stream_scan_jobs ORDER BY created_at DESC LIMIT 50');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch scan history', 500);
  }
};

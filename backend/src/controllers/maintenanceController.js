/**
 * maintenanceController.js
 * Exposes maintenance jobs as HTTP endpoints so they can be triggered
 * on Render (or any server) without needing a terminal.
 *
 * All endpoints are protected by MAINTENANCE_SECRET env var.
 * Set MAINTENANCE_SECRET=your-secret in Render environment variables.
 *
 * Endpoints:
 *   POST /api/internal/maintenance/run-migrations
 *   POST /api/internal/maintenance/dedupe-channels
 *   POST /api/internal/maintenance/check-streams
 *   POST /api/internal/maintenance/activate-channels
 *   POST /api/internal/maintenance/run-all       ← runs all 4 in sequence
 *   GET  /api/internal/maintenance/status        ← current job status
 *
 * Usage from browser/curl/Postman:
 *   POST http://35.154.128.217/api/internal/maintenance/run-all
 *   Header: x-maintenance-secret: your-secret
 */

'use strict';
const db  = require('../config/db');
const { success, error } = require('../utils/response');

// ─── Auth check ────────────────────────────────────────────────────────────
function checkSecret(req, res) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret) {
    res.status(503).json({ success: false, message: 'MAINTENANCE_SECRET not configured on server' });
    return false;
  }
  const provided = req.headers['x-maintenance-secret'] || req.body?.secret;
  if (provided !== secret) {
    res.status(401).json({ success: false, message: 'Invalid maintenance secret' });
    return false;
  }
  return true;
}

// ─── Job state (in-memory, per process) ───────────────────────────────────
const jobState = {
  running: false,
  currentJob: null,
  startedAt: null,
  log: [],
  lastResult: null,
};

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  jobState.log.push(line);
  if (jobState.log.length > 500) jobState.log.shift(); // keep last 500 lines
}

// ─── Canonical name helper (matches dedupe-channels.js) ───────────────────
function canonicalName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\b(hd|sd|fhd|uhd|4k)\b\s*/gi, ' ')
    .replace(/\s*\b(1080p?|720p?|576p?|480p?|360p?|240p?)\b\s*/gi, ' ')
    .replace(/\s*\b(backup|source\s*\d*|live|channel)\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Quality score ─────────────────────────────────────────────────────────
function qualityScore(quality) {
  const q = (quality || '').toLowerCase();
  if (q.includes('1080') || q.includes('fhd')) return 1;
  if (q.includes('720')  || q === 'hd')        return 2;
  if (q.includes('576'))                         return 3;
  if (q.includes('480'))                         return 4;
  if (q === 'sd')                                return 5;
  return 6;
}

function pickMaster(channels) {
  const hOrder = { online: 0, unknown: 1, unstable: 2, offline: 3, merged: 9 };
  return channels.sort((a, b) => {
    const ha = hOrder[a.health_status] ?? 5;
    const hb = hOrder[b.health_status] ?? 5;
    if (ha !== hb) return ha - hb;
    const sa = a.source === 'indian-seed' ? 0 : 1;
    const sb = b.source === 'indian-seed' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const la = a.logo_url ? 0 : 1;
    const lb = b.logo_url ? 0 : 1;
    if (la !== lb) return la - lb;
    return qualityScore(a.quality) - qualityScore(b.quality);
  })[0];
}

// ══════════════════════════════════════════════════════════════════════════
// JOB: Run pending migrations
// ══════════════════════════════════════════════════════════════════════════
async function jobRunMigrations() {
  logLine('=== JOB: Run Migrations ===');
  const fs   = require('fs');
  const path = require('path');

  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
  )`);

  const migrDir = path.join(__dirname, '..', '..', 'migrations');
  if (!fs.existsSync(migrDir)) { logLine('No migrations directory found'); return { applied: 0 }; }

  const files = fs.readdirSync(migrDir).filter(f => f.endsWith('.sql')).sort();
  let applied = 0;

  for (const file of files) {
    const check = await db.query('SELECT 1 FROM schema_migrations WHERE migration_name = $1', [file]);
    if (check.rows.length > 0) { logLine(`  skip (already applied): ${file}`); continue; }
    try {
      const sql = fs.readFileSync(path.join(migrDir, file), 'utf8');
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
      logLine(`  ✓ Applied: ${file}`);
      applied++;
    } catch (err) {
      logLine(`  ✗ Failed: ${file} — ${err.message}`);
    }
  }
  logLine(`Migrations done. Applied: ${applied}`);
  return { applied };
}

// ══════════════════════════════════════════════════════════════════════════
// JOB: Deduplicate channels
// ══════════════════════════════════════════════════════════════════════════
async function jobDedupeChannels() {
  logLine('=== JOB: Deduplicate Channels ===');

  // Ensure columns exist
  await db.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255)`);
  await db.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS merged_into_channel_id INTEGER`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_channels_canonical_name ON channels(canonical_name)`);

  // Backfill canonical_name
  const { rows: needsFill } = await db.query(
    `SELECT id, name FROM channels WHERE canonical_name IS NULL OR canonical_name = ''`
  );
  for (const row of needsFill) {
    await db.query(`UPDATE channels SET canonical_name = $1 WHERE id = $2`,
      [canonicalName(row.name), row.id]);
  }
  logLine(`Backfilled canonical_name for ${needsFill.length} channels`);

  // Find duplicate groups
  const { rows: groups } = await db.query(`
    SELECT canonical_name,
           COALESCE(language,'Unknown') AS language,
           COALESCE(category_id::text,'none') AS cat_key,
           COUNT(*) AS cnt,
           ARRAY_AGG(id ORDER BY id) AS ids
    FROM channels
    WHERE status != 'merged'
      AND canonical_name IS NOT NULL AND canonical_name != ''
    GROUP BY canonical_name, COALESCE(language,'Unknown'), COALESCE(category_id::text,'none')
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `);

  logLine(`Found ${groups.length} duplicate groups`);
  let merged = 0, streamsAdded = 0;

  for (const group of groups) {
    const { rows: channelRows } = await db.query(
      `SELECT id, name, canonical_name, logo_url, stream_url, quality,
              health_status, health_score, source, status
       FROM channels WHERE id = ANY($1)`,
      [group.ids]
    );

    const active = channelRows.filter(c => c.status !== 'merged');
    if (active.length < 2) continue;

    const master = pickMaster(active);
    const dupes  = active.filter(c => c.id !== master.id);

    // Ensure master's stream is in channel_streams
    if (master.stream_url) {
      await db.query(`
        INSERT INTO channel_streams (channel_id,stream_url,quality,priority,source_name,health_status)
        VALUES ($1,$2,$3,1,'original','unknown')
        ON CONFLICT (channel_id,stream_url) DO NOTHING`,
        [master.id, master.stream_url, master.quality || 'SD']);
    }

    for (const dup of dupes) {
      // Copy dup's channel_streams → master
      await db.query(`
        INSERT INTO channel_streams
          (channel_id,stream_url,quality,priority,source_name,user_agent,health_status)
        SELECT $1,stream_url,quality,priority,source_name,user_agent,health_status
        FROM channel_streams WHERE channel_id = $2
        ON CONFLICT (channel_id,stream_url) DO NOTHING`,
        [master.id, dup.id]);

      // Add dup's stream_url directly
      if (dup.stream_url) {
        await db.query(`
          INSERT INTO channel_streams (channel_id,stream_url,quality,priority,source_name,health_status)
          VALUES ($1,$2,$3,2,'merged_duplicate','unknown')
          ON CONFLICT (channel_id,stream_url) DO NOTHING`,
          [master.id, dup.stream_url, dup.quality || 'SD']);
        streamsAdded++;
      }

      // Fix logo if master has none
      if (!master.logo_url && dup.logo_url) {
        await db.query(`UPDATE channels SET logo_url=$1 WHERE id=$2`, [dup.logo_url, master.id]);
        master.logo_url = dup.logo_url;
      }

      // Migrate favorites
      await db.query(`
        UPDATE favorites SET channel_id=$1
        WHERE channel_id=$2
          AND NOT EXISTS (SELECT 1 FROM favorites f2 WHERE f2.user_id=favorites.user_id AND f2.channel_id=$1)`,
        [master.id, dup.id]);
      await db.query(`DELETE FROM favorites WHERE channel_id=$1`, [dup.id]);

      // Migrate watch history
      await db.query(`UPDATE watch_history SET channel_id=$1 WHERE channel_id=$2`, [master.id, dup.id]);

      // Mark as merged
      await db.query(`
        UPDATE channels SET status='merged', health_status='merged',
          merged_into_channel_id=$1, updated_at=NOW() WHERE id=$2`,
        [master.id, dup.id]);

      merged++;
    }

    // Update has_backup_streams
    const { rows: sc } = await db.query(
      `SELECT COUNT(*) cnt FROM channel_streams WHERE channel_id=$1`, [master.id]);
    await db.query(`UPDATE channels SET has_backup_streams=$1 WHERE id=$2`,
      [parseInt(sc[0].cnt, 10) > 1, master.id]);

    logLine(`  ✓ Merged "${group.canonical_name}" — ${dupes.length} dupes removed`);
  }

  logLine(`Dedupe done. Groups: ${groups.length}, Channels merged: ${merged}, Streams added: ${streamsAdded}`);
  return { groups: groups.length, merged, streamsAdded };
}

// ══════════════════════════════════════════════════════════════════════════
// JOB: Activate working channels (set best stream)
// ══════════════════════════════════════════════════════════════════════════
async function jobActivateChannels() {
  logLine('=== JOB: Activate Working Channels ===');

  // Activate online channels with best stream
  const { rowCount: activated } = await db.query(`
    UPDATE channels SET
      status        = 'active',
      health_status = 'online',
      active_stream_id = sub.best_stream_id,
      stream_url    = sub.best_url,
      quality       = sub.best_quality,
      health_score  = sub.best_score,
      updated_at    = NOW()
    FROM (
      SELECT DISTINCT ON (channel_id)
        channel_id, id AS best_stream_id, stream_url AS best_url,
        quality AS best_quality, health_score AS best_score
      FROM channel_streams
      WHERE health_status = 'online'
      ORDER BY channel_id, health_score DESC,
        CASE quality WHEN '720p' THEN 1 WHEN 'HD' THEN 2
          WHEN 'SD' THEN 3 WHEN '1080p' THEN 4 ELSE 5 END,
        fail_count ASC, last_success_at DESC NULLS LAST
    ) sub
    WHERE channels.id = sub.channel_id
      AND channels.status NOT IN ('merged','duplicate')
  `);
  logLine(`  Activated online: ${activated}`);

  // Unstable channels
  const { rowCount: unstabled } = await db.query(`
    UPDATE channels SET status='active', health_status='unstable', updated_at=NOW()
    WHERE health_status != 'online'
      AND status NOT IN ('merged','duplicate')
      AND id IN (SELECT DISTINCT channel_id FROM channel_streams WHERE health_status='unstable')
      AND id NOT IN (SELECT DISTINCT channel_id FROM channel_streams WHERE health_status='online')
      AND status IN ('pending_check','offline','unknown')
  `);
  logLine(`  Activated unstable: ${unstabled}`);

  // Offline channels
  const { rowCount: offlined } = await db.query(`
    UPDATE channels SET status='offline', health_status='offline', updated_at=NOW()
    WHERE status = 'pending_check'
      AND status NOT IN ('merged','duplicate')
      AND id NOT IN (
        SELECT DISTINCT channel_id FROM channel_streams WHERE health_status IN ('online','unstable')
      )
  `);
  logLine(`  Marked offline: ${offlined}`);

  // has_backup_streams
  await db.query(`
    UPDATE channels SET has_backup_streams = (
      SELECT COUNT(*) > 1 FROM channel_streams WHERE channel_id = channels.id
    ) WHERE status NOT IN ('merged','duplicate')
  `);

  logLine('Activation done.');
  return { activated, unstabled, offlined };
}

// ══════════════════════════════════════════════════════════════════════════
// JOB: Generate report (DB stats only, no file write on Render)
// ══════════════════════════════════════════════════════════════════════════
async function jobGenerateReport() {
  logLine('=== JOB: Generate Report ===');

  const [total, active, merged, online, cats, langs] = await Promise.all([
    db.query(`SELECT COUNT(*) c FROM channels`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status='active'`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status='merged'`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status='active' AND health_status='online'`),
    db.query(`SELECT cat.name, COUNT(c.id) cnt FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.status='active' GROUP BY cat.name ORDER BY cnt DESC LIMIT 20`),
    db.query(`SELECT language, COUNT(*) cnt FROM channels WHERE status='active' GROUP BY language ORDER BY cnt DESC LIMIT 15`),
  ]);

  const report = {
    generated_at:   new Date().toISOString(),
    total:          parseInt(total.rows[0].c, 10),
    active:         parseInt(active.rows[0].c, 10),
    merged_hidden:  parseInt(merged.rows[0].c, 10),
    online_in_app:  parseInt(online.rows[0].c, 10),
    by_category:    Object.fromEntries(cats.rows.map(r => [r.name || 'Unknown', parseInt(r.cnt, 10)])),
    by_language:    Object.fromEntries(langs.rows.map(r => [r.language || 'Unknown', parseInt(r.cnt, 10)])),
  };

  logLine(`Total: ${report.total}, Active: ${report.active}, Online shown in app: ${report.online_in_app}, Merged/hidden: ${report.merged_hidden}`);
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ══════════════════════════════════════════════════════════════════════════

exports.getStatus = async (req, res) => {
  if (!checkSecret(req, res)) return;
  success(res, {
    running:    jobState.running,
    currentJob: jobState.currentJob,
    startedAt:  jobState.startedAt,
    lastResult: jobState.lastResult,
    recentLog:  jobState.log.slice(-50),
  });
};

async function runJob(res, name, fn) {
  if (jobState.running) {
    return res.status(409).json({
      success: false,
      message: `Another job is running: ${jobState.currentJob}. Try again later.`,
    });
  }

  jobState.running   = true;
  jobState.currentJob = name;
  jobState.startedAt = new Date().toISOString();
  jobState.log       = [];

  // Respond immediately — job runs in background
  res.json({
    success: true,
    message: `Job "${name}" started. Poll GET /api/internal/maintenance/status for progress.`,
    startedAt: jobState.startedAt,
  });

  // Run async
  try {
    const result = await fn();
    jobState.lastResult = { job: name, success: true, result, completedAt: new Date().toISOString() };
    logLine(`Job "${name}" completed successfully`);
  } catch (err) {
    jobState.lastResult = { job: name, success: false, error: err.message, completedAt: new Date().toISOString() };
    logLine(`Job "${name}" FAILED: ${err.message}`);
    console.error(err);
  } finally {
    jobState.running    = false;
    jobState.currentJob = null;
  }
}

exports.runMigrations = async (req, res) => {
  if (!checkSecret(req, res)) return;
  await runJob(res, 'run-migrations', jobRunMigrations);
};

exports.dedupeChannels = async (req, res) => {
  if (!checkSecret(req, res)) return;
  await runJob(res, 'dedupe-channels', jobDedupeChannels);
};

exports.activateChannels = async (req, res) => {
  if (!checkSecret(req, res)) return;
  await runJob(res, 'activate-channels', jobActivateChannels);
};

exports.generateReport = async (req, res) => {
  if (!checkSecret(req, res)) return;
  await runJob(res, 'generate-report', jobGenerateReport);
};

exports.runAll = async (req, res) => {
  if (!checkSecret(req, res)) return;
  await runJob(res, 'run-all', async () => {
    const r1 = await jobRunMigrations();
    const r2 = await jobDedupeChannels();
    const r3 = await jobActivateChannels();
    const r4 = await jobGenerateReport();
    return { migrations: r1, dedupe: r2, activation: r3, report: r4 };
  });
};

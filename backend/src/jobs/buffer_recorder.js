'use strict';

/**
 * buffer_recorder.js
 * Rolling HLS segment recorder for Smooth Playback / Delayed Live feature.
 *
 * Architecture:
 *   Original Stream → fetch M3U8 → download .ts segments → disk storage
 *   → delayed manifest served by smoothPlaybackController
 *
 * Safety rules:
 *   - Only records channels with smooth_playback_enabled = true
 *   - Skips channels with health_status in BLOCKED_STATUSES (DRM, geo-blocked, etc.)
 *   - Rolling buffer only — old segments deleted automatically
 *   - Max concurrent recorders controlled by MAX_CONCURRENT_RECORDERS env var
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const db = require('../config/db');

// ── Config ────────────────────────────────────────────────────────────────────
const STORAGE_BASE = process.env.BUFFER_STORAGE_PATH
  || path.join(__dirname, '../../storage/buffers');

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_RECORDERS || '5', 10);
const POLL_INTERVAL_MS = 3000;          // how often to poll the live M3U8
const SEGMENT_FETCH_TIMEOUT_MS = 15000; // per-segment download timeout
const MAX_RETRIES_BEFORE_OFFLINE = 5;   // consecutive fetch failures before marking source_offline

// Health statuses that must NEVER be buffered (DRM, geo-block, unlicensed, etc.)
const BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);

// ── In-memory recorder registry ───────────────────────────────────────────────
// channelId → { timer, seenSequences, retryCount, sessionId }
const activeRecorders = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

async function startRecorder(channelId) {
  if (activeRecorders.has(channelId)) return; // already running
  if (activeRecorders.size >= MAX_CONCURRENT) {
    console.warn(`[buffer_recorder] MAX_CONCURRENT (${MAX_CONCURRENT}) reached, cannot start channel ${channelId}`);
    return;
  }

  const channel = await _getEligibleChannel(channelId);
  if (!channel) return;

  const bufferDir = path.join(STORAGE_BASE, String(channelId));
  fs.mkdirSync(bufferDir, { recursive: true });

  // Create or resume session in DB
  const sessionRes = await db.query(
    `INSERT INTO delayed_buffer_sessions (channel_id, status, started_at, updated_at)
     VALUES ($1, 'running', NOW(), NOW())
     RETURNING id`,
    [channelId]
  );
  const sessionId = sessionRes.rows[0].id;

  await db.query(
    `UPDATE channels SET buffer_status = 'warming_up', is_buffer_ready = false, updated_at = NOW() WHERE id = $1`,
    [channelId]
  );

  const state = { seenSequences: new Set(), retryCount: 0, sessionId, channelId };
  const timer = setInterval(() => _pollChannel(state, channel, bufferDir), POLL_INTERVAL_MS);
  activeRecorders.set(channelId, { timer, state });

  console.log(`[buffer_recorder] Started recorder for channel ${channelId} (${channel.name})`);
}

async function stopRecorder(channelId) {
  const rec = activeRecorders.get(channelId);
  if (!rec) return;
  clearInterval(rec.timer);
  activeRecorders.delete(channelId);

  await db.query(
    `UPDATE channels SET buffer_status = 'stopped', is_buffer_ready = false, updated_at = NOW() WHERE id = $1`,
    [channelId]
  ).catch(() => {});
  await db.query(
    `UPDATE delayed_buffer_sessions SET status = 'stopped', updated_at = NOW()
     WHERE channel_id = $1 AND status = 'running'`,
    [channelId]
  ).catch(() => {});

  console.log(`[buffer_recorder] Stopped recorder for channel ${channelId}`);
}

function getActiveRecorders() {
  return [...activeRecorders.keys()];
}

/**
 * Called on app startup — starts recorders for all channels that have
 * smooth_playback_enabled = true and are not blocked.
 */
async function startAllEnabledRecorders() {
  try {
    const res = await db.query(
      `SELECT id FROM channels
       WHERE smooth_playback_enabled = true
         AND status = 'active'
         AND is_hidden IS NOT TRUE
         AND is_removed IS NOT TRUE
         AND (health_status IS NULL OR health_status NOT IN (
           'requires_licensed_source','drm_or_unsupported','geo_blocked',
           'forbidden_403','offline','dead'
         ))`
    );
    for (const row of res.rows) {
      await startRecorder(row.id);
    }
    console.log(`[buffer_recorder] Auto-started ${res.rows.length} recorders`);
  } catch (err) {
    console.error('[buffer_recorder] startAllEnabledRecorders error:', err.message);
  }
}

/**
 * Cleanup job — removes segments older than max buffer window.
 * Run periodically (e.g. every 2 minutes).
 */
async function cleanupOldSegments() {
  try {
    // Find channels with smooth playback enabled
    const channels = await db.query(
      `SELECT id, playback_delay_seconds, max_buffer_segments FROM channels WHERE smooth_playback_enabled = true`
    );

    for (const ch of channels.rows) {
      const maxSecs = Math.min(ch.playback_delay_seconds * 2, 600); // keep 2x delay, max 10 min
      const cutoff = new Date(Date.now() - maxSecs * 1000).toISOString();

      // Get segments to delete
      const toDelete = await db.query(
        `SELECT file_path FROM delayed_buffer_segments
         WHERE channel_id = $1 AND created_at < $2`,
        [ch.id, cutoff]
      );

      for (const seg of toDelete.rows) {
        const fullPath = path.join(STORAGE_BASE, seg.file_path);
        fs.unlink(fullPath, () => {}); // fire-and-forget
      }

      await db.query(
        `DELETE FROM delayed_buffer_segments WHERE channel_id = $1 AND created_at < $2`,
        [ch.id, cutoff]
      );
    }
  } catch (err) {
    console.error('[buffer_recorder] cleanupOldSegments error:', err.message);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _getEligibleChannel(channelId) {
  const res = await db.query(
    `SELECT id, name, stream_url, health_status, playback_delay_seconds,
            smooth_playback_enabled, restream_mode
     FROM channels WHERE id = $1`,
    [channelId]
  );
  if (res.rows.length === 0) return null;
  const ch = res.rows[0];
  if (!ch.smooth_playback_enabled) return null;
  if (!ch.stream_url) return null;
  if (BLOCKED_STATUSES.has(ch.health_status)) {
    console.warn(`[buffer_recorder] Channel ${channelId} blocked (${ch.health_status}), skipping`);
    return null;
  }
  return ch;
}

async function _pollChannel(state, channel, bufferDir) {
  try {
    const m3u8Url = channel.stream_url;
    const response = await fetch(m3u8Url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const segments = _parseM3U8Segments(text, m3u8Url);

    if (segments.length === 0) {
      state.retryCount++;
      if (state.retryCount >= MAX_RETRIES_BEFORE_OFFLINE) {
        await _markSourceOffline(state.channelId, 'No segments in M3U8');
      }
      return;
    }

    state.retryCount = 0;

    // Download only new segments
    for (const seg of segments) {
      if (state.seenSequences.has(seg.sequence)) continue;
      state.seenSequences.add(seg.sequence);
      await _downloadSegment(state, seg, bufferDir);
    }

    // Update buffer depth
    await _updateBufferDepth(state.channelId, channel.playback_delay_seconds);

  } catch (err) {
    state.retryCount++;
    console.error(`[buffer_recorder] Poll error channel ${state.channelId}:`, err.message);

    await db.query(
      `UPDATE channels SET last_buffer_error = $1, updated_at = NOW() WHERE id = $2`,
      [err.message.slice(0, 500), state.channelId]
    ).catch(() => {});

    if (state.retryCount >= MAX_RETRIES_BEFORE_OFFLINE) {
      await _markSourceOffline(state.channelId, err.message);
    } else {
      await db.query(
        `UPDATE channels SET buffer_status = 'source_slow', updated_at = NOW() WHERE id = $1`,
        [state.channelId]
      ).catch(() => {});
    }
  }
}

async function _downloadSegment(state, seg, bufferDir) {
  try {
    const response = await fetch(seg.url, {
      timeout: SEGMENT_FETCH_TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' },
    });

    if (!response.ok) throw new Error(`Segment HTTP ${response.status}`);

    const buffer = await response.buffer();
    const fileName = `seg_${String(seg.sequence).padStart(6, '0')}.ts`;
    const relativePath = path.join(String(state.channelId), fileName);
    const fullPath = path.join(STORAGE_BASE, relativePath);

    fs.writeFileSync(fullPath, buffer);

    // Record in DB
    await db.query(
      `INSERT INTO delayed_buffer_segments
         (channel_id, segment_name, sequence_number, duration, file_size_bytes, file_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (channel_id, sequence_number) DO NOTHING`,
      [state.channelId, fileName, seg.sequence, seg.duration, buffer.length, relativePath]
    );

    // Update session
    await db.query(
      `UPDATE delayed_buffer_sessions
       SET last_segment_at = NOW(), segment_count = segment_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [state.sessionId]
    ).catch(() => {});

  } catch (err) {
    console.error(`[buffer_recorder] Segment download error ch=${state.channelId} seq=${seg.sequence}:`, err.message);
    await db.query(
      `UPDATE channels SET buffer_status = 'segment_missing', last_buffer_error = $1, updated_at = NOW() WHERE id = $2`,
      [err.message.slice(0, 500), state.channelId]
    ).catch(() => {});
  }
}

async function _updateBufferDepth(channelId, delaySeconds) {
  try {
    const res = await db.query(
      `SELECT COALESCE(SUM(duration), 0)::int as depth_seconds
       FROM delayed_buffer_segments
       WHERE channel_id = $1`,
      [channelId]
    );
    const depth = res.rows[0].depth_seconds;
    const isReady = depth >= delaySeconds;

    let status = 'warming_up';
    if (isReady) status = 'ready';
    else if (depth > 0 && depth < delaySeconds * 0.5) status = 'low_buffer';

    await db.query(
      `UPDATE channels
       SET buffer_depth_seconds = $1, is_buffer_ready = $2, buffer_status = $3, updated_at = NOW()
       WHERE id = $4`,
      [depth, isReady, status, channelId]
    );
  } catch (err) {
    console.error('[buffer_recorder] _updateBufferDepth error:', err.message);
  }
}

async function _markSourceOffline(channelId, reason) {
  await db.query(
    `UPDATE channels
     SET buffer_status = 'source_offline', is_buffer_ready = false,
         last_buffer_error = $1, updated_at = NOW()
     WHERE id = $2`,
    [reason?.slice(0, 500), channelId]
  ).catch(() => {});

  await db.query(
    `UPDATE delayed_buffer_sessions SET status = 'error', error_message = $1, updated_at = NOW()
     WHERE channel_id = $2 AND status = 'running'`,
    [reason?.slice(0, 500), channelId]
  ).catch(() => {});

  // Stop the recorder — admin must re-enable after fixing source
  stopRecorder(channelId);
}

/**
 * Parse an HLS M3U8 playlist and return segment list with sequence numbers.
 * Handles both absolute and relative segment URLs.
 */
function _parseM3U8Segments(text, baseUrl) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const segments = [];
  let sequence = 0;
  let duration = 0;

  // Extract EXT-X-MEDIA-SEQUENCE for proper sequence numbering
  const seqMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
  if (seqMatch) sequence = parseInt(seqMatch[1], 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.split(':')[1]) || 0;
    } else if (!line.startsWith('#') && (line.endsWith('.ts') || line.includes('.ts?') || line.includes('segment'))) {
      const url = line.startsWith('http') ? line : _resolveUrl(baseUrl, line);
      segments.push({ url, sequence, duration });
      sequence++;
      duration = 0;
    }
  }

  return segments;
}

function _resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
    return baseDir + relative;
  }
}

module.exports = {
  startRecorder,
  stopRecorder,
  getActiveRecorders,
  startAllEnabledRecorders,
  cleanupOldSegments,
};

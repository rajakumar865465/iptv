'use strict';

/**
 * buffer_recorder.js
 * Rolling HLS segment recorder for Smooth Playback / Delayed Live feature.
 * Implements Intelligent Stream Selection, Fallback Systems, and Stale Buffer support.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const db = require('../config/db');

// ── Config ────────────────────────────────────────────────────────────────────
const STORAGE_BASE = process.env.BUFFER_STORAGE_PATH || path.join(__dirname, '../../storage/buffers');
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_RECORDERS || '5', 10);
const POLL_INTERVAL_MS = 3000;
const FALLBACK_POLL_INTERVAL_MS = 30000;
// 8s per-attempt: a single bad segment with 3×20s retries could block the recorder
// for 65s, starving the playlist and causing the player to run out of video.
// 2 retries × 8s + backoffs ≈ 18s max — still safe for slow CDNs but much less starvation.
const SEGMENT_FETCH_TIMEOUT_MS = 8000;
const M3U8_FETCH_TIMEOUT_MS = 18000; // Increased from 12s to 18s for unstable networks
const STALE_BUFFER_WINDOW_SEC = 90;
const MAX_STALE_BUFFER_AGE_SEC = 300;
const FAILURE_THRESHOLD_FOR_FALLBACK = 3; // Changed from 2 to 3 to allow retries
const MAX_RETRIES_BEFORE_FALLBACK = 2; // Retry same stream before switching
const RETRY_BACKOFF_MS = [500, 1500, 3000]; // Exponential backoff for retries
const EXCLUDED_STREAM_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown before retrying excluded streams
const STREAM_TEST_TIMEOUT_MS = 8000; // Timeout for testing a backup stream
// No-chunks watchdog: if a recorder fetches manifests but lands zero good segments
// within this window of starting, flip to no_working_source so the client falls back
// to direct live instead of warming forever.
const NO_CHUNKS_TIMEOUT_MS = parseInt(process.env.NO_CHUNKS_TIMEOUT_MS || '45000', 10);

const BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);
const BLOCKED_LICENSE_TYPES = new Set([
  'paid_drm', 'drm', 'unlicensed', 'unauthorized', 'pirated'
]);

// Segment statuses for delayed_buffer_segments.segment_status column
const SEG_STATUS_GOOD = 'good';
const SEG_STATUS_MISSING = 'missing';
const SEG_STATUS_SKIPPED = 'skipped';
const SEG_STATUS_RECOVERED = 'recovered';
const SEG_STATUS_BACKUP = 'backup';
const SEG_STATUS_LOWER_QUALITY = 'lower_quality';

// Max segment download retries before skipping.
// Reduced from 3→2 retries with tighter backoffs: 3×20s was blocking for 65s on bad segments.
// 2 retries × 8s timeout + [300, 1000]ms backoffs ≈ 17.3s max — fast enough to skip dead
// segments before the live window advances past them.
const MAX_SEGMENT_RETRIES = 2;
const SEGMENT_RETRY_BACKOFF_MS = [300, 1000];

// channelId -> { timer, state }
const activeRecorders = new Map();
const pendingRecorders = new Set();

// ── Public API ────────────────────────────────────────────────────────────────

async function startRecorder(channelId) {
  if (activeRecorders.has(channelId)) return;
  if (pendingRecorders.has(channelId)) return;

  if (activeRecorders.size >= MAX_CONCURRENT) {
    console.warn(`[buffer_recorder] MAX_CONCURRENT (${MAX_CONCURRENT}) reached, cannot start channel ${channelId}`);
    return;
  }

  pendingRecorders.add(channelId);
  try {
    const channel = await _getEligibleChannel(channelId);
    if (!channel) return;

    const stream = await _selectWorkingStream(channelId, channel);

    if (!stream || !stream.stream_url) {
      console.error(`[buffer_recorder] No working stream URL available for channel ${channelId}`);
      const needsVerification = channel.is_premium || channel.is_paid || channel.is_important;
      await _updateChannelState(channelId, {
        buffer_status: needsVerification ? 'requires_licensed_source' : 'no_working_source',
        recorder_status_detail: needsVerification ? 'requires_licensed_source' : 'no_working_source',
        recorder_last_failure_at: new Date(),
        recorder_last_failure_reason: 'No working source available for smooth playback',
        needs_manual_verification: needsVerification,
        is_buffer_ready: false
      });
      return;
    }

    const bufferDir = path.join(STORAGE_BASE, String(channelId));
    fs.mkdirSync(bufferDir, { recursive: true });

    const sessionRes = await db.query(
      `INSERT INTO delayed_buffer_sessions (channel_id, status, started_at, updated_at)
       VALUES ($1, 'running', NOW(), NOW())
       ON CONFLICT (channel_id) DO UPDATE SET status = 'running', updated_at = NOW()
       RETURNING id`,
      [channelId]
    );
    const sessionId = sessionRes.rows[0].id;

    await _updateChannelState(channelId, {
      recorder_stream_url: stream.stream_url,
      recorder_stream_id: stream.id || null,
      buffer_status: 'warming_up',
      is_buffer_ready: false,
      recorder_fail_count: 0,
      recorder_backup_attempts: 0,
      recorder_status_detail: 'initializing'
    });

    const state = {
      seenSequences: new Set(),
      sessionId,
      channelId,
      currentPollInterval: POLL_INTERVAL_MS,
      failedStreamIds: [],
      failedStreamExcludeMap: {}, // Track when streams were excluded for cooldown
      currentStreamRetries: 0, // Track retries for current stream
      channel: channel,
      bufferDir: bufferDir,
      startedAt: Date.now(),
      firstGoodSegmentAt: null, // set when the first good/backup/lower_quality segment persists
      // Headers from the active stream — sent with every manifest + segment request.
      // Populated from channel_streams so sources that require Referer/Origin work correctly.
      streamHeaders: _buildStreamHeaders(stream),
    };

    const timer = setInterval(() => _pollChannel(state), state.currentPollInterval);
    activeRecorders.set(channelId, { timer, state });

    console.log(`[buffer_recorder] Started recorder for channel ${channelId} (${channel.name}) using stream ${stream.id || 'channel_url'}`);
  } catch (err) {
    console.error(`[buffer_recorder] Critical error starting recorder for ${channelId}:`, err);
  } finally {
    pendingRecorders.delete(channelId);
  }
}

async function stopRecorder(channelId) {
  const rec = activeRecorders.get(channelId);
  if (!rec) return;

  clearInterval(rec.timer);
  activeRecorders.delete(channelId);

  await _updateChannelState(channelId, {
    buffer_status: 'stopped',
    is_buffer_ready: false
  });

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

async function startAllEnabledRecorders() {
  try {
    // Order by popularity/featured so the MAX_CONCURRENT cap favors the most-watched
    // channels first (pre-warm mode). Lower-ranked channels fall back to on-demand start
    // when a user opens them (see smoothPlaybackController.getSmoothPlayback).
    const res = await db.query(
      `SELECT id FROM channels
       WHERE smooth_playback_enabled = true
         AND status = 'active'
         AND is_hidden IS NOT TRUE
         AND is_removed IS NOT TRUE
         AND (health_status IS NULL OR health_status NOT IN (
           'requires_licensed_source','drm_or_unsupported','geo_blocked',
           'forbidden_403','offline','dead'
         ))
       ORDER BY is_featured DESC NULLS LAST,
                is_popular DESC NULLS LAST,
                popularity_score DESC NULLS LAST,
                name ASC`
    );
    let started = 0;
    for (const row of res.rows) {
      const before = activeRecorders.size;
      await startRecorder(row.id);
      if (activeRecorders.size > before) started++;
    }
    console.log(`[buffer_recorder] Auto-started ${started} recorders (of ${res.rows.length} eligible, cap ${MAX_CONCURRENT})`);
  } catch (err) {
    console.error('[buffer_recorder] startAllEnabledRecorders error:', err.message);
  }
}

async function cleanupOldSegments() {
  try {
    const channels = await db.query(
      `SELECT id, playback_delay_seconds, max_buffer_segments FROM channels WHERE smooth_playback_enabled = true`
    );

    for (const ch of channels.rows) {
      const maxSecs = Math.min(ch.playback_delay_seconds * 2, 600);
      const cutoff = new Date(Date.now() - maxSecs * 1000).toISOString();

      const toDelete = await db.query(
        `SELECT file_path FROM delayed_buffer_segments
         WHERE channel_id = $1 AND created_at < $2`,
        [ch.id, cutoff]
      );

      for (const seg of toDelete.rows) {
        const fullPath = path.join(STORAGE_BASE, seg.file_path);
        fs.unlink(fullPath, () => {});
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

async function forceFallback(channelId) {
  console.log(`[buffer_recorder] Force fallback triggered for channel ${channelId}`);
  await _updateChannelState(channelId, { recorder_fail_count: 0 });
  const rec = activeRecorders.get(channelId);
  if (rec) {
    await _tryFallbackStream(rec.state);
  }
}

async function clearStaleBuffer(channelId) {
  console.log(`[buffer_recorder] Clearing stale buffer for channel ${channelId}`);
  await _updateChannelState(channelId, {
    recorder_stale_buffer_until: null,
    recorder_fail_count: 0
  });
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

async function _getEligibleChannel(channelId) {
  const res = await db.query(
    `SELECT id, name, stream_url, health_status, playback_delay_seconds,
            smooth_playback_enabled, is_premium, is_important
     FROM channels WHERE id = $1`,
    [channelId]
  );
  if (res.rows.length === 0) return null;
  const ch = res.rows[0];
  if (!ch.smooth_playback_enabled) return null;
  if (BLOCKED_STATUSES.has(ch.health_status)) return null;
  return ch;
}

async function _selectBestStream(channelId, excludeStreamIds = [], excludeMap = {}) {
  const candidates = await _getCandidateStreams(channelId, excludeStreamIds, excludeMap, 1);
  return candidates[0] || null;
}

async function _getCandidateStreams(channelId, excludeStreamIds = [], excludeMap = {}, limit = 10) {
  const now = Date.now();
  const activeExcludeIds = excludeStreamIds.filter(id => {
    const excludedAt = excludeMap[id];
    if (!excludedAt) return true;
    return (now - excludedAt) < EXCLUDED_STREAM_COOLDOWN_MS;
  });

  const excludeClause = activeExcludeIds.length > 0
    ? `AND id NOT IN (${activeExcludeIds.map((_, i) => `$${i + 2}`).join(',')})`
    : '';
  const params = activeExcludeIds.length > 0 ? [channelId, ...activeExcludeIds] : [channelId];

  const res = await db.query(
    `SELECT id, stream_url, license_type, health_status, fail_count, quality, restream_enabled
     FROM channel_streams
     WHERE channel_id = $1
       AND is_hidden IS NOT TRUE
       AND stream_url IS NOT NULL
       AND stream_url <> ''
       AND (license_type IS NULL OR license_type NOT IN ('paid_drm', 'drm', 'unlicensed', 'unauthorized', 'pirated'))
       AND (health_status IS NULL OR health_status NOT IN (
         'requires_licensed_source','drm_or_unsupported','geo_blocked',
         'forbidden_403','offline','dead'
       ))
       ${excludeClause}
     ORDER BY
       CASE WHEN health_status IN ('stable', 'online') THEN 0 ELSE 1 END,
       last_success_at DESC NULLS LAST,
       fail_count ASC,
       android_playable DESC,
       segment_load_success_1 DESC,
       CASE WHEN license_type IN ('free', 'licensed', 'public') THEN 0 ELSE 1 END,
       priority ASC,
       CASE
         WHEN LOWER(COALESCE(quality, 'auto')) IN ('auto', 'hd', '1080p', '720p') THEN 0
         WHEN LOWER(COALESCE(quality, 'auto')) IN ('sd', '480p') THEN 1
         ELSE 2
       END,
       health_score DESC NULLS LAST
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  return res.rows;
}

async function _selectWorkingStream(channelId, channel, excludeStreamIds = [], excludeMap = {}) {
  const candidates = await _getCandidateStreams(channelId, excludeStreamIds, excludeMap, 12);

  if (channel.stream_url && !candidates.some(s => s.stream_url === channel.stream_url)) {
    candidates.push({
      id: null,
      stream_url: channel.stream_url,
      license_type: 'channel_primary',
      health_status: channel.health_status,
      fail_count: channel.fail_count || 0,
      quality: 'auto',
    });
  }

  for (const candidate of candidates) {
    if (BLOCKED_LICENSE_TYPES.has(String(candidate.license_type || '').toLowerCase())) continue;

    const test = await _testStream(candidate.stream_url, _buildStreamHeaders(candidate));
    if (test.ok) {
      if (candidate.id) await _markStreamSuccess(candidate.id);
      return candidate;
    }

    if (candidate.id) {
      await _markStreamFailure(candidate.id, test.reason);
      if (!excludeStreamIds.includes(candidate.id)) excludeStreamIds.push(candidate.id);
      excludeMap[candidate.id] = Date.now();
    }
    await _logFallback(channelId, null, candidate.id || null, 'failed', test.reason);
  }

  return null;
}

function _buildStreamHeaders(stream) {
  if (!stream) return { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' };
  const h = { 'User-Agent': stream.user_agent || 'Mozilla/5.0 NivaTV/1.0' };
  if (stream.referer) h['Referer'] = stream.referer;
  if (stream.origin) h['Origin'] = stream.origin;
  return h;
}

async function _testStream(streamUrl, streamHeaders) {
  const hdrs = streamHeaders || { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' };
  try {
    let text = await _fetchTextWithTimeout(streamUrl, STREAM_TEST_TIMEOUT_MS, hdrs);
    let resolvedUrl = streamUrl;

    // Resolve master playlist to a media playlist before checking segments
    if (_isMasterPlaylist(text)) {
      const variantUrl = _selectBestVariantUrl(text, streamUrl);
      if (!variantUrl) return { ok: false, reason: 'Master playlist has no variant streams' };
      text = await _fetchTextWithTimeout(variantUrl, STREAM_TEST_TIMEOUT_MS, hdrs);
      resolvedUrl = variantUrl;
    }

    const segments = _parseM3U8Segments(text, resolvedUrl);
    if (segments.length === 0) return { ok: false, reason: 'No playable segments in manifest' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TEST_TIMEOUT_MS);
    const response = await fetch(segments[0].url, {
      signal: controller.signal,
      headers: { ...hdrs, Range: 'bytes=0-2047' },
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok && response.status !== 206) return { ok: false, reason: `Segment HTTP ${response.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: _normalizeErrorMessage(err) };
  }
}

async function _fetchTextWithTimeout(url, timeoutMs, headers) {
  const hdrs = headers || { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: hdrs,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function _normalizeErrorMessage(err) {
  if (err.name === 'AbortError') return 'timeout';
  return err.message || String(err);
}
async function _pollChannel(state) {
  try {
    const currentChannel = await db.query(
      `SELECT recorder_stream_url, recorder_stream_id, recorder_stale_buffer_until,
              is_premium, is_important, playback_delay_seconds, buffer_depth_seconds
       FROM channels WHERE id = $1`,
      [state.channelId]
    );
    const chData = currentChannel.rows[0];
    if (!chData) {
      console.error(`[buffer_recorder] Channel ${state.channelId} not found`);
      await stopRecorder(state.channelId);
      return;
    }

    const isInStaleMode = chData.recorder_stale_buffer_until && new Date(chData.recorder_stale_buffer_until) > new Date();
    const bufferAge = chData.buffer_depth_seconds || 0;

    if (isInStaleMode && bufferAge > 0 && bufferAge < MAX_STALE_BUFFER_AGE_SEC) {
      console.log(`[buffer_recorder] Channel ${state.channelId} in stale mode, buffer age: ${bufferAge}s`);
    }

    const m3u8Url = chData.recorder_stream_url;
    if (!m3u8Url) throw new Error('No recorder_stream_url configured');

    let text = await _fetchTextWithTimeout(m3u8Url, M3U8_FETCH_TIMEOUT_MS, state.streamHeaders);
    let resolvedUrl = m3u8Url;

    // If this is a master playlist, follow the best-quality variant
    if (_isMasterPlaylist(text)) {
      const variantUrl = _selectBestVariantUrl(text, m3u8Url);
      if (!variantUrl) throw new Error('Master playlist has no variant streams');
      text = await _fetchTextWithTimeout(variantUrl, M3U8_FETCH_TIMEOUT_MS, state.streamHeaders);
      resolvedUrl = variantUrl;
      // Persist the resolved media playlist URL so future polls use it directly
      await _updateChannelState(state.channelId, { recorder_stream_url: variantUrl });
    }

    const segments = _parseM3U8Segments(text, resolvedUrl);

    if (segments.length === 0) throw new Error('No segments in M3U8');

    // Success! Reset state
    await _updateChannelState(state.channelId, {
      recorder_fail_count: 0,
      recorder_last_success_at: new Date(),
      recorder_stale_buffer_until: null,
      recorder_status_detail: 'active'
    });

    // Reset retry counter on success
    state.currentStreamRetries = 0;
    
    // Clear failed streams list periodically on success to allow retrying after cooldown
    if (state.failedStreamIds && state.failedStreamIds.length > 0) {
      console.log(`[buffer_recorder] Channel ${state.channelId}: Stream recovered, clearing failed list`);
      state.failedStreamIds = [];
      state.failedStreamExcludeMap = {};
    }

    if (state.currentPollInterval !== POLL_INTERVAL_MS) {
      state.currentPollInterval = POLL_INTERVAL_MS;
      _restartTimer(state);
    }

    // No-chunks watchdog: manifest loads but no segment has persisted yet.
    // If we've been running past NO_CHUNKS_TIMEOUT_MS with zero good segments, the
    // source is effectively unusable — flip to no_working_source so the client stops
    // showing the warming overlay and falls back to direct live.
    if (!state.firstGoodSegmentAt && (Date.now() - state.startedAt) > NO_CHUNKS_TIMEOUT_MS) {
      console.warn(`[buffer_recorder] No chunks after ${Math.round(NO_CHUNKS_TIMEOUT_MS/1000)}s for channel ${state.channelId} — marking no_working_source`);
      const ch = state.channel || {};
      const needsVerification = ch.is_premium || ch.is_paid || ch.is_important;
      await _updateChannelState(state.channelId, {
        buffer_status: needsVerification ? 'requires_licensed_source' : 'no_working_source',
        recorder_status_detail: needsVerification ? 'requires_licensed_source' : 'no_working_source',
        recorder_last_failure_at: new Date(),
        recorder_last_failure_reason: 'No segments produced within timeout',
        needs_manual_verification: needsVerification,
        is_buffer_ready: false
      });
      await stopRecorder(state.channelId);
      return;
    }

    for (const seg of segments) {
      if (state.seenSequences.has(seg.sequence)) continue;
      state.seenSequences.add(seg.sequence);
      // Prevent unbounded growth — keep only the last 2000 sequence numbers
      if (state.seenSequences.size > 2000) {
        const oldest = state.seenSequences.values().next().value;
        state.seenSequences.delete(oldest);
      }
      await _downloadSegment(state, seg);
    }

    await _updateBufferDepth(state.channelId, chData.playback_delay_seconds);

  } catch (err) {
    await _handlePollError(state, err);
  }
}

// Classify error type to determine retry strategy
function _classifyError(err) {
  const msg = err.message || '';
  
  // Permanent failures (don't retry same stream)
  if (msg.includes('HTTP 403') || msg.includes('HTTP 404') || msg.includes('HTTP 410')) {
    return 'permanent';
  }
  
  // Transient failures (retry with backoff)
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') ||
      msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || 
      msg.includes('HTTP 5') || msg.includes('No segments')) {
    return 'transient';
  }
  
  // Unknown - treat as transient
  return 'transient';
}

async function _handlePollError(state, err) {
  const errorType = _classifyError(err);
  const errMessage = _normalizeErrorMessage(err);
  console.error(`[buffer_recorder] Poll error channel ${state.channelId} (${errorType}):`, errMessage);

  const currentChannel = await db.query(
    `SELECT recorder_fail_count, recorder_stale_buffer_until, recorder_stream_id,
            is_premium, is_paid, is_important, buffer_depth_seconds, playback_delay_seconds,
            recorder_stream_url
     FROM channels WHERE id = $1`,
    [state.channelId]
  );
  const chData = currentChannel.rows[0];
  
  // Initialize retry count if not exists
  if (!state.currentStreamRetries) {
    state.currentStreamRetries = 0;
  }
  
  const hasExistingBuffer = (chData.buffer_depth_seconds || 0) > 0;
  let staleUntil = chData.recorder_stale_buffer_until;

  // Set stale buffer window if buffer exists and not already set
  if (!staleUntil && hasExistingBuffer) {
    staleUntil = new Date(Date.now() + STALE_BUFFER_WINDOW_SEC * 1000);
    console.log(`[buffer_recorder] Channel ${state.channelId}: Primary stream timeout. Keeping buffer alive while retrying...`);
  }

  // For transient errors, retry same stream with backoff before switching
  if (errorType === 'transient' && state.currentStreamRetries < MAX_RETRIES_BEFORE_FALLBACK) {
    state.currentStreamRetries++;
    const backoffMs = RETRY_BACKOFF_MS[state.currentStreamRetries - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
    
    console.log(`[buffer_recorder] Channel ${state.channelId}: Transient error, retry ${state.currentStreamRetries}/${MAX_RETRIES_BEFORE_FALLBACK} after ${backoffMs}ms`);
    
    const updates = {
      recorder_last_failure_at: new Date(),
      recorder_last_failure_reason: `Retrying (${state.currentStreamRetries}/${MAX_RETRIES_BEFORE_FALLBACK}): ${errMessage.slice(0, 400)}`,
      recorder_stale_buffer_until: staleUntil,
      buffer_status: hasExistingBuffer ? 'source_timeout' : 'retrying',
      recorder_status_detail: `retry_attempt_${state.currentStreamRetries}`
    };
    
    await _updateChannelState(state.channelId, updates);
    
    // Add backoff delay before next poll
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    return;
  }

  // Retries exhausted or permanent error - increment fail count
  const newFailCount = (chData.recorder_fail_count || 0) + 1;
  state.currentStreamRetries = 0; // Reset retry counter

  const updates = {
    recorder_fail_count: newFailCount,
    recorder_last_failure_at: new Date(),
    recorder_last_failure_reason: `${errorType}: ${errMessage.slice(0, 450)}`,
    recorder_stale_buffer_until: staleUntil,
    buffer_status: hasExistingBuffer ? 'source_timeout' : 'source_offline',
    recorder_status_detail: hasExistingBuffer ? 'trying_backup' : 'source_unavailable'
  };

  // Mark premium/important channels for manual verification
  if ((chData.is_premium || chData.is_paid || chData.is_important) && newFailCount >= 2) {
    updates.needs_manual_verification = true;
    updates.recorder_status_detail = 'needs_manual_verification';
    console.log(`[buffer_recorder] Channel ${state.channelId}: Premium/important channel needs manual verification`);
  }

  await _updateChannelState(state.channelId, updates);

  // Try fallback after threshold reached
  if (newFailCount >= FAILURE_THRESHOLD_FOR_FALLBACK) {
    const needsImmediateFallback = !staleUntil || new Date(staleUntil) <= new Date() || !hasExistingBuffer;

    if (needsImmediateFallback) {
      console.log(`[buffer_recorder] Channel ${state.channelId}: Attempting fallback to backup stream...`);
      const fallbackSuccess = await _tryFallbackStream(state);
      if (!fallbackSuccess) {
        if (state.currentPollInterval !== FALLBACK_POLL_INTERVAL_MS) {
          state.currentPollInterval = FALLBACK_POLL_INTERVAL_MS;
          _restartTimer(state);
          console.log(`[buffer_recorder] Channel ${state.channelId}: All sources failed. Slowed polling to ${FALLBACK_POLL_INTERVAL_MS}ms`);
        }
      }
    } else {
      const remainingSec = Math.floor((new Date(staleUntil) - Date.now()) / 1000);
      console.log(`[buffer_recorder] Channel ${state.channelId}: Using stale buffer while retrying (${remainingSec}s remaining)`);
    }
  }
}

function _restartTimer(state) {
  const rec = activeRecorders.get(state.channelId);
  if (!rec) return;

  clearInterval(rec.timer);
  rec.timer = setInterval(() => _pollChannel(state), state.currentPollInterval);
  console.log(`[buffer_recorder] Channel ${state.channelId}: Poll interval changed to ${state.currentPollInterval}ms`);
}

async function _tryFallbackStream(state) {
  try {
    const channelId = state.channelId;
    await _updateChannelState(channelId, {
      buffer_status: 'trying_backup',
      recorder_status_detail: 'searching_backup_stream'
    });

    const channel = await db.query(
      'SELECT id, stream_url, is_premium, is_paid, is_important, health_status, fail_count FROM channels WHERE id = $1',
      [channelId]
    );
    const chData = channel.rows[0];
    if (!chData) return false;

    const current = await db.query(
      'SELECT recorder_stream_id, recorder_stream_url FROM channels WHERE id = $1',
      [channelId]
    );
    const currentStreamId = current.rows[0]?.recorder_stream_id;
    const currentStreamUrl = current.rows[0]?.recorder_stream_url;

    if (!state.failedStreamExcludeMap) state.failedStreamExcludeMap = {};
    if (currentStreamId && !state.failedStreamIds.includes(currentStreamId)) {
      state.failedStreamIds.push(currentStreamId);
      state.failedStreamExcludeMap[currentStreamId] = Date.now();
    }

    await _updateChannelState(channelId, { recorder_failed_stream_url: currentStreamUrl || null });

    console.log(`[buffer_recorder] Channel ${channelId}: Trying fallback streams (excluded: ${state.failedStreamIds.join(', ')})`);

    const candidate = await _selectWorkingStream(channelId, chData, state.failedStreamIds, state.failedStreamExcludeMap);

    if (candidate) {
      const backupCountRes = await db.query(
        'SELECT recorder_backup_attempts FROM channels WHERE id = $1',
        [channelId]
      );
      const backupCount = (backupCountRes.rows[0]?.recorder_backup_attempts || 0) + 1;

      await _updateChannelState(channelId, {
        recorder_stream_url: candidate.stream_url,
        recorder_stream_id: candidate.id || null,
        recorder_failed_stream_url: currentStreamUrl || null,
        recorder_backup_stream_url: candidate.stream_url,
        recorder_fail_count: 0,
        recorder_backup_attempts: backupCount,
        recorder_stale_buffer_until: null,
        buffer_status: 'backup_active',
        recorder_status_detail: candidate.id ? 'backup_active' : 'fallback_to_main_url'
      });

      await _logFallback(channelId, currentStreamId, candidate.id || null, 'success', `Backup stream ${candidate.id || 'channel_url'} active`);

      console.log(`[buffer_recorder] Channel ${channelId}: Backup stream ${candidate.id || 'channel_url'} is working. Switched successfully.`);

      // Update stream headers for the new source so manifest + segment requests use correct credentials
      state.streamHeaders = _buildStreamHeaders(candidate);
      state.currentStreamRetries = 0;
      state.currentPollInterval = POLL_INTERVAL_MS;
      _restartTimer(state);

      return true;
    }

    const needsVerification = chData.is_premium || chData.is_paid || chData.is_important;
    await _updateChannelState(channelId, {
      buffer_status: needsVerification ? 'requires_licensed_source' : 'no_working_source',
      recorder_status_detail: needsVerification ? 'requires_licensed_source' : 'no_working_source',
      needs_manual_verification: needsVerification
    });

    await _logFallback(channelId, currentStreamId, null, 'all_failed', 'No working backup source available');

    console.log(`[buffer_recorder] Channel ${channelId}: No working source available. Will retry in background.`);

    return false;
  } catch (err) {
    console.error(`[buffer_recorder] Fallback error for ${state.channelId}:`, err);
    return false;
  }
}
async function _markStreamFailure(streamId, reason) {
  await db.query(
    `UPDATE channel_streams
     SET fail_count = COALESCE(fail_count, 0) + 1,
         last_failed_at = NOW(),
         health_status = CASE
           WHEN COALESCE(fail_count, 0) + 1 >= 3 THEN 'unstable'
           ELSE 'timeout'
         END,
         health_reason = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [streamId, String(reason || 'timeout').slice(0, 400)]
  ).catch(() => {});
}

async function _markStreamSuccess(streamId) {
  await db.query(
    `UPDATE channel_streams
     SET success_count = COALESCE(success_count, 0) + 1,
         fail_count = 0,
         last_success_at = NOW(),
         health_status = CASE
           WHEN health_status IN ('unstable', 'timeout', 'unknown') THEN 'online'
           ELSE COALESCE(health_status, 'online')
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [streamId]
  ).catch(() => {});
}
async function _logFallback(channelId, fromStreamId, toStreamId, result, notes) {
  try {
    const fromUrl = fromStreamId
      ? await db.query('SELECT stream_url FROM channel_streams WHERE id = $1', [fromStreamId])
          .then(r => r.rows[0]?.stream_url)
      : null;
    const toUrl = toStreamId
      ? await db.query(
            'SELECT stream_url FROM channel_streams WHERE id = $1', [toStreamId])
          .then(r => r.rows[0]?.stream_url)
      : null;

    await db.query(
      `INSERT INTO recorder_fallback_log
         (channel_id, from_stream_url, from_stream_id, to_stream_url, to_stream_id, result, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [channelId, fromUrl, fromStreamId, toUrl, toStreamId, result, notes]
    ).catch(() => {});
  } catch (err) {
  }
}

async function _downloadSegment(state, seg) {
  // Try primary download with retries, then backup, then lower-quality fallback.
  // Per work.md: never retry one dead segment forever — skip after MAX_SEGMENT_RETRIES.
  const channelId = state.channelId;
  const fileName = `seg_${String(seg.sequence).padStart(6, '0')}.ts`;
  const relativePath = path.join(String(channelId), fileName);
  const fullPath = path.join(STORAGE_BASE, relativePath);

  // ── Attempt 1: Download from primary source with retries ────────────────────
  let primaryResult = null;
  for (let attempt = 1; attempt <= MAX_SEGMENT_RETRIES; attempt++) {
    primaryResult = await _tryDownloadSegment(seg.url, fullPath, state.streamHeaders);
    if (primaryResult.ok) break;

    if (attempt < MAX_SEGMENT_RETRIES) {
      const backoff = SEGMENT_RETRY_BACKOFF_MS[attempt - 1] || 2000;
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  let finalBuffer = primaryResult && primaryResult.ok ? primaryResult.buffer : null;
  let segmentStatus = SEG_STATUS_GOOD;
  let sourceType = 'primary';
  let recoveryMethod = null;

  // ── Attempt 2: Try backup stream if primary failed ──────────────────────────
  if (!finalBuffer) {
    const backupSeg = await _tryBackupSegment(state, seg);
    if (backupSeg.ok) {
      finalBuffer = backupSeg.buffer;
      segmentStatus = SEG_STATUS_BACKUP;
      sourceType = 'backup';
      recoveryMethod = 'backup_stream';
      console.log(`[buffer_recorder] ch=${channelId} seq=${seg.sequence}: recovered from backup stream`);
    }
  }

  // ── Attempt 3: Try lower-quality stream if still no segment ────────────────
  if (!finalBuffer) {
    const lowerSeg = await _tryLowerQualitySegment(state, seg);
    if (lowerSeg.ok) {
      finalBuffer = lowerSeg.buffer;
      segmentStatus = SEG_STATUS_LOWER_QUALITY;
      sourceType = 'lower_quality';
      recoveryMethod = 'lower_quality_stream';
      console.log(`[buffer_recorder] ch=${channelId} seq=${seg.sequence}: recovered from lower-quality stream`);
    }
  }

  // ── Outcome: skip or save ──────────────────────────────────────────────────
  if (finalBuffer) {
    if (!state.firstGoodSegmentAt) state.firstGoodSegmentAt = Date.now();
    fs.writeFileSync(fullPath, finalBuffer);
    await db.query(
      `INSERT INTO delayed_buffer_segments
         (channel_id, segment_name, sequence_number, duration, file_size_bytes, file_path,
          segment_status, source_type, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (channel_id, sequence_number) DO UPDATE SET
         segment_status = EXCLUDED.segment_status,
         source_type = EXCLUDED.source_type,
         is_verified = true,
         file_size_bytes = EXCLUDED.file_size_bytes`,
      [channelId, fileName, seg.sequence, seg.duration, finalBuffer.length, relativePath,
       segmentStatus, sourceType]
    );
    await db.query(
      `UPDATE delayed_buffer_sessions
       SET last_segment_at = NOW(), segment_count = segment_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [state.sessionId]
    ).catch(() => {});

    // Update channel buffer health counters
    await _updateBufferCounters(channelId, {
      downloaded: true,
      recovered: segmentStatus === SEG_STATUS_RECOVERED || segmentStatus === SEG_STATUS_BACKUP || segmentStatus === SEG_STATUS_LOWER_QUALITY,
      backup: segmentStatus === SEG_STATUS_BACKUP,
      lowerQuality: segmentStatus === SEG_STATUS_LOWER_QUALITY,
      lastSuccess: true,
    });
  } else {
    // Could not recover — mark as skipped (skip_missing_chunks mode default)
    await db.query(
      `INSERT INTO delayed_buffer_segments
         (channel_id, segment_name, sequence_number, duration, file_path, segment_status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (channel_id, sequence_number) DO UPDATE SET
         segment_status = EXCLUDED.segment_status,
         is_verified = false`,
      [channelId, fileName, seg.sequence, seg.duration, relativePath, SEG_STATUS_SKIPPED]
    );

    console.warn(`[buffer_recorder] ch=${channelId} seq=${seg.sequence}: SKIPPED (unavailable, skipping per skip_missing_chunks mode)`);

    await _updateBufferCounters(channelId, {
      skipped: true,
      lastMissing: true,
    });

    await _updateChannelState(channelId, {
      buffer_status: 'segment_missing',
      recorder_status_detail: `segment_skipped: seq ${seg.sequence}`,
      last_source_error: `Segment ${seg.sequence} could not be recovered`,
    });
  }
}

// ── Helper: attempt a single segment download from a URL ─────────────────────
async function _tryDownloadSegment(url, fullPath, streamHeaders) {
  const hdrs = streamHeaders || { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEGMENT_FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: hdrs,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };

    const buffer = await response.buffer();
    // Verify segment is not an HTML/error response and has a valid size
    if (buffer.length < 1000) return { ok: false, reason: 'segment too small (possibly HTML error page)' };
    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, reason: _normalizeErrorMessage(err) };
  }
}

// ── Helper: try to recover segment from a backup stream ─────────────────────
async function _tryBackupSegment(state, seg) {
  try {
    const res = await db.query(
      `SELECT cs.id, cs.stream_url, cs.user_agent, cs.referer, cs.origin
       FROM channel_streams cs
       WHERE cs.channel_id = $1
         AND cs.is_hidden IS NOT TRUE
         AND cs.stream_url IS NOT NULL
         AND cs.stream_url <> $2
         AND (cs.license_type IS NULL OR cs.license_type NOT IN ('paid_drm','drm','unlicensed','unauthorized','pirated'))
         AND (cs.health_status IS NULL OR cs.health_status NOT IN ('requires_licensed_source','drm_or_unsupported','geo_blocked','forbidden_403','offline','dead'))
       ORDER BY cs.health_score DESC NULLS LAST, cs.priority ASC
       LIMIT 3`,
      [state.channelId, seg.url]
    );

    for (const backup of res.rows) {
      // Fetch the backup playlist to find a segment with matching approximate timestamp
      const headers = { 'User-Agent': backup.user_agent || 'Mozilla/5.0 NivaTV/1.0' };
      if (backup.referer) headers['Referer'] = backup.referer;
      if (backup.origin) headers['Origin'] = backup.origin;

      const m3u8Text = await _fetchTextWithTimeout(backup.stream_url, M3U8_FETCH_TIMEOUT_MS).catch(() => null);
      if (!m3u8Text) continue;

      const backupSegs = _parseM3U8Segments(m3u8Text, backup.stream_url);
      // Pick the most recent segment from the backup (time-window match is approximate)
      const targetSeg = backupSegs[backupSegs.length - 1];
      if (!targetSeg) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEGMENT_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(targetSeg.url, { signal: controller.signal, headers }).finally(() => clearTimeout(timeoutId));
        if (!response.ok) continue;
        const buffer = await response.buffer();
        if (buffer.length < 1000) continue;
        return { ok: true, buffer };
      } catch {
        continue;
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// ── Helper: try to recover segment from a lower-quality stream ──────────────
async function _tryLowerQualitySegment(state, seg) {
  try {
    const res = await db.query(
      `SELECT id, stream_url, user_agent, referer, origin, quality, resolution_height
       FROM channel_streams
       WHERE channel_id = $1
         AND is_hidden IS NOT TRUE
         AND stream_url IS NOT NULL
         AND (resolution_height IS NOT NULL AND resolution_height < 720)
         AND (license_type IS NULL OR license_type NOT IN ('paid_drm','drm','unlicensed','unauthorized','pirated'))
         AND (health_status IS NULL OR health_status NOT IN ('requires_licensed_source','drm_or_unsupported','geo_blocked','forbidden_403','offline','dead'))
       ORDER BY resolution_height ASC, health_score DESC NULLS LAST
       LIMIT 2`,
      [state.channelId]
    );

    for (const lower of res.rows) {
      const headers = { 'User-Agent': lower.user_agent || 'Mozilla/5.0 NivaTV/1.0' };
      if (lower.referer) headers['Referer'] = lower.referer;
      if (lower.origin) headers['Origin'] = lower.origin;

      const m3u8Text = await _fetchTextWithTimeout(lower.stream_url, M3U8_FETCH_TIMEOUT_MS).catch(() => null);
      if (!m3u8Text) continue;

      const lowerSegs = _parseM3U8Segments(m3u8Text, lower.stream_url);
      const targetSeg = lowerSegs[lowerSegs.length - 1];
      if (!targetSeg) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEGMENT_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(targetSeg.url, { signal: controller.signal, headers }).finally(() => clearTimeout(timeoutId));
        if (!response.ok) continue;
        const buffer = await response.buffer();
        if (buffer.length < 1000) continue;
        return { ok: true, buffer };
      } catch {
        continue;
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// ── Helper: update per-channel buffer health counters + clean buffer % ────────
async function _updateBufferCounters(channelId, opts) {
  try {
    const inc = (col) => `, ${col} = COALESCE(${col}, 0) + 1`;
    const setClauses = [];
    if (opts.downloaded) setClauses.push('downloaded_segments = COALESCE(downloaded_segments, 0) + 1');
    if (opts.skipped) setClauses.push('skipped_segment_count = COALESCE(skipped_segment_count, 0) + 1');
    if (opts.missing) setClauses.push('missing_segment_count = COALESCE(missing_segment_count, 0) + 1');
    if (opts.recovered) setClauses.push('recovered_segment_count = COALESCE(recovered_segment_count, 0) + 1');
    if (opts.backup) setClauses.push('backup_segment_count = COALESCE(backup_segment_count, 0) + 1');
    if (opts.lowerQuality) setClauses.push('lower_quality_segment_count = COALESCE(lower_quality_segment_count, 0) + 1');
    if (opts.lastSuccess) setClauses.push('last_successful_segment_at = NOW()');
    if (opts.lastMissing) setClauses.push('last_missing_segment_at = NOW()');

    // total_expected_segments: increment whenever we attempt a segment
    setClauses.push('total_expected_segments = COALESCE(total_expected_segments, 0) + 1');

    await _updateChannelState(channelId, {});
    // Compute clean buffer percentage from good (downloaded) vs expected
    const statRes = await db.query(
      `UPDATE channels SET
         ${setClauses.join(', ')},
         clean_buffer_percentage = CASE
           WHEN COALESCE(total_expected_segments, 0) = 0 THEN 100
           ELSE LEAST(100, ROUND((COALESCE(downloaded_segments, 0)::numeric / COALESCE(total_expected_segments, 1)) * 100, 2))
         END,
         buffer_quality_status = CASE
           WHEN COALESCE(downloaded_segments, 0)::numeric / NULLIF(COALESCE(total_expected_segments, 0), 0) >= 0.85 THEN 'clean_buffer'
           WHEN COALESCE(downloaded_segments, 0)::numeric / NULLIF(COALESCE(total_expected_segments, 0), 0) >= 0.65 THEN 'minor_gaps'
           WHEN COALESCE(downloaded_segments, 0)::numeric / NULLIF(COALESCE(total_expected_segments, 0), 0) >= 0.60 THEN 'too_many_missing_segments'
           ELSE 'no_working_source'
         END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING clean_buffer_percentage, buffer_quality_status`,
      [channelId]
    );
    return statRes.rows[0];
  } catch (err) {
    console.error(`[buffer_recorder] _updateBufferCounters error for ${channelId}:`, err.message);
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

    const statusRes = await db.query('SELECT buffer_status FROM channels WHERE id = $1', [channelId]);
    const currentStatus = statusRes.rows[0]?.buffer_status;

    let status = 'warming_up';
    if (isReady) status = 'buffer_ready';
    else if (currentStatus === 'backup_active') status = 'backup_active';
    else if (depth > 0 && depth < delaySeconds * 0.5) status = 'low_buffer';

    await _updateChannelState(channelId, {
      buffer_depth_seconds: depth,
      is_buffer_ready: isReady,
      buffer_status: status
    });
  } catch (err) {
    console.error('[buffer_recorder] _updateBufferDepth error:', err.message);
  }
}
async function _updateChannelState(channelId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = Object.values(updates);

  try {
    await db.query(
      `UPDATE channels SET ${setClause}, updated_at = NOW() WHERE id = $1`,
      [channelId, ...values]
    );
  } catch (err) {
    console.error(`[buffer_recorder] _updateChannelState error for ${channelId}:`, err);
  }
}

function _isMasterPlaylist(text) {
  return text.includes('#EXT-X-STREAM-INF');
}

function _selectBestVariantUrl(text, baseUrl) {
  // Pick the highest-bandwidth variant from a master playlist
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let bestBandwidth = -1;
  let bestUrl = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      const urlLine = lines[i + 1];
      if (urlLine && !urlLine.startsWith('#')) {
        const variantUrl = urlLine.startsWith('http') ? urlLine : _resolveUrl(baseUrl, urlLine);
        if (bw > bestBandwidth) {
          bestBandwidth = bw;
          bestUrl = variantUrl;
        }
      }
    }
  }
  return bestUrl;
}

function _parseM3U8Segments(text, baseUrl) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const segments = [];
  let sequence = 0;
  let duration = 0;

  const seqMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
  if (seqMatch) sequence = parseInt(seqMatch[1], 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.split(':')[1]) || 0;
    } else if (!line.startsWith('#') && duration > 0) {
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
  forceFallback,
  clearStaleBuffer
};
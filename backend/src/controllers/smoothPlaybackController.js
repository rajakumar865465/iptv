'use strict';

/**
 * smoothPlaybackController.js
 * Handles:
 *   - GET /api/channels/:id/smooth-playback  → returns delayed playback URL or direct fallback
 *   - GET /api/smooth/:channelId/playlist.m3u8 → serves delayed HLS master playlist
 *   - GET /api/smooth/:channelId/media.m3u8   → serves delayed HLS media playlist
 *   - GET /api/smooth/:channelId/segments/:name → serves cached .ts segment
 *   - Admin CRUD for smooth playback settings
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { success, error } = require('../utils/response');
const bufferRecorder = require('../jobs/buffer_recorder');
const { generateSmoothToken } = require('../utils/jwt');

const STORAGE_BASE = process.env.BUFFER_STORAGE_PATH
  || path.join(__dirname, '../../storage/buffers');
const STALE_BUFFER_WINDOW_SEC = 90;

// Health statuses that must never be buffered
const BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);

// Clean buffer percentage thresholds (per work.md)
const SERVE_NORMAL_THRESHOLD = 85;      // Serve smooth playback normally
const SERVE_WITH_WARNING_THRESHOLD = 65; // Serve with source-unstable warning
const DO_NOT_SERVE_THRESHOLD = 60;       // Below this, do not serve smooth playback

// Gap handling modes
const GAP_MODES = new Set(['skip_missing_chunks', 'black_filler', 'strict_stop']);

// Buffer quality statuses considered "healthy enough" to keep serving
const SERVABLE_BUFFER_STATUSES = new Set([
  'buffer_ready', 'warming_up', 'clean_buffer', 'minor_gaps',
  'gap_repaired', 'skipping_missing_segments', 'using_backup_segments',
  'using_lower_quality_segments', 'backup_active', 'low_buffer',
]);

// Compute clean buffer percentage and derived buffer_quality_status.
// downloadedGood = good/recovered segments; expected = total expected segments so far.
function computeBufferQuality(downloadedGood, expectedTotal, missingCount, skippedCount, backupCount, lowerQCount) {
  const expected = Math.max(1, expectedTotal);
  const pct = Math.min(100, Math.max(0, (downloadedGood / expected) * 100));
  const rounded = Math.round(pct * 100) / 100;

  let status;
  if (expected <= 0) {
    status = 'warming_up';
  } else if (backupCount > 0 && pct < 85) {
    status = 'using_backup_segments';
  } else if (lowerQCount > 0 && pct < 85) {
    status = 'using_lower_quality_segments';
  } else if (missingCount === 0 && skippedCount === 0 && pct >= 99.5) {
    status = 'clean_buffer';
  } else if (skippedCount > 0 && missingCount === 0) {
    status = 'gap_repaired';
  } else if (skippedCount > 0) {
    status = 'skipping_missing_segments';
  } else if (pct >= SERVE_NORMAL_THRESHOLD) {
    status = 'clean_buffer';
  } else if (pct >= SERVE_WITH_WARNING_THRESHOLD) {
    status = 'minor_gaps';
  } else if (pct >= DO_NOT_SERVE_THRESHOLD) {
    status = 'too_many_missing_segments';
  } else {
    status = 'no_working_source';
  }
  return { percentage: rounded, status };
}

// ── Public: get smooth playback info for a channel ────────────────────────────

exports.getSmoothPlayback = async (req, res) => {
  try {
    const { id } = req.params;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    const result = await db.query(
      `SELECT id, name, stream_url, health_status,
              smooth_playback_enabled, playback_delay_seconds,
              buffer_status, buffer_depth_seconds, is_buffer_ready,
              restream_mode, last_buffer_error,
              recorder_stream_url, recorder_stream_id, recorder_fail_count,
              recorder_last_success_at, recorder_last_failure_at,
              recorder_last_failure_reason, recorder_backup_attempts,
              recorder_status_detail, recorder_failed_stream_url, recorder_backup_stream_url,
              needs_manual_verification,
              is_hidden, is_removed,
              gap_handling_mode, allow_skip_missing_segments,
              missing_segment_count, skipped_segment_count, recovered_segment_count,
              backup_segment_count, lower_quality_segment_count,
              clean_buffer_percentage, buffer_quality_status,
              total_expected_segments, downloaded_segments,
              last_missing_segment_at, last_successful_segment_at,
              last_source_error, active_recorder_stream_id, backup_active
       FROM channels WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return error(res, 'Channel not found', 404);
    const ch = result.rows[0];

    if (ch.is_hidden || ch.is_removed) {
      return res.status(403).json({ success: false, message: 'Channel not available', error_code: 'CHANNEL_NOT_AVAILABLE' });
    }

    // Channel has DRM/geo-block/unlicensed status — never buffer
    if (BLOCKED_STATUSES.has(ch.health_status)) {
      return success(res, {
        playback_mode: 'requires_licensed_source',
        delay_seconds: 0,
        delayed_stream_url: null,
        buffer_ready: false,
        buffer_depth_seconds: 0,
        primary_stream_id: parseInt(id),
        health_status: ch.health_status,
        buffer_quality_status: 'requires_licensed_source',
        gap_warning: false,
        can_go_live: false,
        direct_live_url: null,
        message: 'This channel requires a licensed source and cannot be buffered.',
      });
    }

    // Determine whether Go Live (direct live) is allowed for this channel
    const directLiveUrl = ch.stream_url || null;
    const canGoLive = !!directLiveUrl && !BLOCKED_STATUSES.has(ch.health_status);

    // Smooth playback not enabled — return direct mode
    if (!ch.smooth_playback_enabled || ch.restream_mode === 'direct') {
      return success(res, {
        playback_mode: 'direct',
        delay_seconds: 0,
        delayed_stream_url: null,
        buffer_ready: false,
        buffer_depth_seconds: 0,
        primary_stream_id: parseInt(id),
        health_status: ch.health_status || 'unknown',
        buffer_quality_status: ch.buffer_quality_status || 'clean_buffer',
        gap_warning: false,
        smooth_playback_enabled: false,
        direct_live_url: directLiveUrl,
        can_go_live: canGoLive,
      });
    }

    const smoothToken = generateSmoothToken(id, req.user?.id || null);
    const delayedUrl = `${baseUrl}/api/smooth/${id}/playlist.m3u8?t=${smoothToken}`;

    // Buffer not ready yet — start on-demand if not already running
    if (!ch.is_buffer_ready) {
      const active = bufferRecorder.getActiveRecorders();
      if (!active.includes(parseInt(id)) && !BLOCKED_STATUSES.has(ch.health_status)) {
        bufferRecorder.startRecorder(parseInt(id)).catch(() => {});
      }

      let statusMessage = 'Preparing smooth playback...';
      let statusCode = 'warming_up';
      
      // Provide user-friendly status messages based on recorder state
      if (ch.recorder_status_detail && ch.recorder_status_detail.startsWith('retry_attempt_')) {
        statusMessage = 'Source temporarily unavailable. Retrying...';
        statusCode = 'retrying';
      } else if (ch.buffer_status === 'trying_backup' || ch.recorder_status_detail === 'searching_backup_stream') {
        statusMessage = 'Primary source timeout. Trying another source...';
        statusCode = 'trying_backup';
      } else if (ch.buffer_status === 'backup_active' || ch.recorder_status_detail === 'backup_active') {
        statusMessage = 'Using backup source. Building buffer...';
        statusCode = 'backup_active';
      } else if (ch.buffer_status === 'source_timeout') {
        statusMessage = 'Primary source timeout. Trying backup source...';
        statusCode = 'source_timeout';
      } else if (ch.buffer_status === 'no_working_source' || ch.recorder_status_detail === 'no_working_source') {
        statusMessage = 'Stream unavailable. No stable source is available right now.';
        statusCode = 'no_working_source';
      } else if (ch.buffer_status === 'requires_licensed_source' || ch.recorder_status_detail === 'requires_licensed_source') {
        statusMessage = 'This channel requires a licensed source and cannot be buffered.';
        statusCode = 'requires_licensed_source';
      } else if (ch.recorder_status_detail === 'needs_manual_verification') {
        statusMessage = 'This channel requires manual verification.';
        statusCode = 'needs_verification';
      }

      return success(res, {
        playback_mode: 'delayed',
        delay_seconds: ch.playback_delay_seconds || 300,
        required_delay_seconds: ch.playback_delay_seconds || 300,
        delayed_stream_url: delayedUrl,
        buffer_ready: false,
        buffer_depth_seconds: ch.buffer_depth_seconds || 0,
        buffer_status: ch.buffer_status || 'warming_up',
        recorder_status: ch.recorder_status_detail || ch.buffer_status || 'warming_up',
        recorder_status_detail: ch.recorder_status_detail,
        status_code: statusCode,
        primary_stream_id: parseInt(id),
        health_status: ch.health_status || 'unknown',
        message: statusMessage,
        fallback_direct_url: ch.stream_url,
        last_failure_reason: ch.recorder_last_failure_reason || null,
        last_failure_at: ch.recorder_last_failure_at || null,
        failed_stream_url: ch.recorder_failed_stream_url || null,
        backup_stream_url: ch.recorder_backup_stream_url || null,
        smooth_playback_enabled: true,
        gap_handling_mode: ch.gap_handling_mode || 'skip_missing_chunks',
        allow_skip_missing_segments: ch.allow_skip_missing_segments !== false,
        buffer_quality_status: ch.buffer_quality_status || 'warming_up',
        clean_buffer_percentage: ch.clean_buffer_percentage !== null ? Number(ch.clean_buffer_percentage) : 0,
        missing_segment_count: ch.missing_segment_count || 0,
        skipped_segment_count: ch.skipped_segment_count || 0,
        recovered_segment_count: ch.recovered_segment_count || 0,
        backup_segment_count: ch.backup_segment_count || 0,
        lower_quality_segment_count: ch.lower_quality_segment_count || 0,
        gap_warning: false,
        direct_live_url: directLiveUrl,
        can_go_live: canGoLive,
      });
    }

    // Buffer is ready — compute gap_warning based on clean buffer percentage
    const cleanPct = ch.clean_buffer_percentage !== null ? Number(ch.clean_buffer_percentage) : 100;
    const bufferQuality = ch.buffer_quality_status || 'buffer_ready';
    // Show gap_warning when buffer quality is degraded but still servable
    const showGapWarning = (
      bufferQuality === 'skipping_missing_segments' ||
      bufferQuality === 'minor_gaps' ||
      bufferQuality === 'gap_repaired' ||
      bufferQuality === 'using_backup_segments' ||
      bufferQuality === 'using_lower_quality_segments' ||
      (cleanPct < SERVE_NORMAL_THRESHOLD && cleanPct >= SERVE_WITH_WARNING_THRESHOLD)
    );

    // If clean buffer is too low, do not serve smooth playback — instruct app to fall back
    if (cleanPct < DO_NOT_SERVE_THRESHOLD) {
      return success(res, {
        playback_mode: 'delayed',
        delay_seconds: ch.playback_delay_seconds || 300,
        required_delay_seconds: ch.playback_delay_seconds || 300,
        delayed_stream_url: delayedUrl,
        buffer_ready: false,
        buffer_depth_seconds: ch.buffer_depth_seconds || 0,
        buffer_status: ch.buffer_status || 'buffer_ready',
        recorder_status: ch.recorder_status_detail || ch.buffer_status || 'buffer_ready',
        primary_stream_id: parseInt(id),
        health_status: ch.health_status || 'unknown',
        smooth_playback_enabled: true,
        gap_handling_mode: ch.gap_handling_mode || 'skip_missing_chunks',
        buffer_quality_status: 'too_many_missing_segments',
        clean_buffer_percentage: cleanPct,
        missing_segment_count: ch.missing_segment_count || 0,
        skipped_segment_count: ch.skipped_segment_count || 0,
        gap_warning: true,
        gap_warning_message: 'This channel is unstable right now.',
        direct_live_url: directLiveUrl,
        fallback_direct_url: ch.stream_url,
        can_go_live: canGoLive,
        message: 'This channel is unstable right now.',
      });
    }

    return success(res, {
      playback_mode: 'delayed',
      delay_seconds: ch.playback_delay_seconds || 300,
      required_delay_seconds: ch.playback_delay_seconds || 300,
      delayed_stream_url: delayedUrl,
      buffer_ready: true,
      buffer_depth_seconds: ch.buffer_depth_seconds || 0,
      buffer_status: ch.buffer_status || 'buffer_ready',
      recorder_status: ch.recorder_status_detail || ch.buffer_status || 'buffer_ready',
      primary_stream_id: parseInt(id),
      health_status: ch.health_status || 'unknown',
      smooth_playback_enabled: true,
      gap_handling_mode: ch.gap_handling_mode || 'skip_missing_chunks',
      allow_skip_missing_segments: ch.allow_skip_missing_segments !== false,
      buffer_quality_status: bufferQuality,
      clean_buffer_percentage: cleanPct,
      missing_segment_count: ch.missing_segment_count || 0,
      skipped_segment_count: ch.skipped_segment_count || 0,
      recovered_segment_count: ch.recovered_segment_count || 0,
      backup_segment_count: ch.backup_segment_count || 0,
      lower_quality_segment_count: ch.lower_quality_segment_count || 0,
      gap_warning: showGapWarning,
      gap_warning_message: showGapWarning
        ? 'Channel source is unstable. Continuing playback...'
        : null,
      direct_live_url: directLiveUrl,
      fallback_direct_url: ch.stream_url,
      can_go_live: canGoLive,
    });

  } catch (err) {
    console.error('getSmoothPlayback error:', err);
    error(res, 'Failed to get smooth playback info', 500);
  }
};

// ── Serve delayed HLS master playlist ────────────────────────────────────────

exports.servePlaylist = async (req, res) => {
  try {
    const { channelId } = req.params;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    const token = req.query.t;
    try {
      const { verifySmoothToken } = require('../utils/jwt');
      verifySmoothToken(token, channelId);
    } catch (err) {
      return res.status(401).send('Unauthorized');
    }

    const mediaUrl = `${baseUrl}/api/smooth/${channelId}/media.m3u8?t=${token}`;

    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-STREAM-INF:BANDWIDTH=1000000,CODECS="avc1.42e01e,mp4a.40.2"`,
      mediaUrl,
    ].join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlist);
  } catch (err) {
    console.error('servePlaylist error:', err);
    res.status(500).send('Error generating playlist');
  }
};

// ── Serve delayed HLS media playlist ─────────────────────────────────────────

exports.serveMediaPlaylist = async (req, res) => {
  try {
    const { channelId } = req.params;
    const token = req.query.t;
    try {
      const { verifySmoothToken } = require('../utils/jwt');
      verifySmoothToken(token, channelId);
    } catch (err) {
      return res.status(401).send('Unauthorized');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    // Get channel config — include gap handling mode
    const chRes = await db.query(
      `SELECT playback_delay_seconds, is_buffer_ready, buffer_status, recorder_stale_buffer_until,
              gap_handling_mode, allow_skip_missing_segments, min_clean_buffer_percentage
       FROM channels WHERE id = $1`,
      [channelId]
    );
    if (chRes.rows.length === 0) return res.status(404).send('Channel not found');

    const ch = chRes.rows[0];
    const delaySeconds = ch.playback_delay_seconds || 300;
    const gapMode = ch.gap_handling_mode || 'skip_missing_chunks';
    const allowSkip = ch.allow_skip_missing_segments !== false;
    const minCleanPct = ch.min_clean_buffer_percentage || DO_NOT_SERVE_THRESHOLD;

    // Get segments within the delayed window — include segment_status to filter out missing/bad ones
    const now = Date.now();
    const cutoffTime = new Date(now - delaySeconds * 1000).toISOString();
    const oldestAllowedTime = new Date(now - (delaySeconds + STALE_BUFFER_WINDOW_SEC) * 1000).toISOString();

    const segsRes = await db.query(
      `SELECT segment_name, sequence_number, duration, segment_status, source_type
       FROM delayed_buffer_segments
       WHERE channel_id = $1 AND created_at <= $2 AND created_at >= $3
       ORDER BY sequence_number ASC
       LIMIT 30`,
      [channelId, cutoffTime, oldestAllowedTime]
    );

    if (segsRes.rows.length === 0) {
      return res.status(503).send('Buffer not ready');
    }

    // ── Filter segments based on gap handling mode ────────────────────────────
    // skip_missing_chunks (default): only serve good/recovered/backup/lower_quality segments.
    //   Missing/skipped segments are excluded from the playlist entirely.
    // strict_stop: if ANY missing/skipped segment exists, return 503 (used for testing/special channels).
    // black_filler: serve all segments (missing ones would need a filler file — handled at recorder level).
    let servableSegments = segsRes.rows;
    let hasMissing = false;

    if (gapMode === 'skip_missing_chunks' && allowSkip) {
      const BAD_STATUSES = new Set(['missing', 'skipped']);
      servableSegments = segsRes.rows.filter(s => !BAD_STATUSES.has(s.segment_status));
      hasMissing = segsRes.rows.some(s => s.segment_status === 'missing');
    } else if (gapMode === 'strict_stop') {
      const BAD_STATUSES = new Set(['missing', 'skipped']);
      hasMissing = segsRes.rows.some(s => BAD_STATUSES.has(s.segment_status));
      if (hasMissing) {
        return res.status(503).send('Channel is unstable (strict stop)');
      }
    }
    // black_filler mode: serve all segments as-is

    if (servableSegments.length === 0) {
      return res.status(503).send('No available segments (channel source unstable)');
    }

    // ── Build rolling-window live playlist ────────────────────────────────────
    // Keep the playlist a valid sliding window: correct MEDIA-SEQUENCE (first served segment),
    // correct TARGETDURATION (max duration of served segments), and DISCONTINUITY markers when
    // we skip a segment or switch source_type (e.g. primary → backup/lower_quality).
    let previousSource = null;
    let previousSeq = null;
    let maxDuration = 0;
    const firstSeq = servableSegments[0].sequence_number;

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
    ];
    // EXT-X-TARGETDURATION filled after we know the max duration
    lines.push(`#EXT-X-MEDIA-SEQUENCE:${firstSeq}`);

    for (const seg of servableSegments) {
      const dur = parseFloat(seg.duration) || 0;
      if (dur > maxDuration) maxDuration = dur;

      // Add discontinuity marker when source changes or sequence skips (gap was removed)
      const sourceChanged = previousSource && seg.source_type && previousSource !== seg.source_type;
      const seqJumped = previousSeq !== null && seg.sequence_number > previousSeq + 1;
      if (sourceChanged || seqJumped) {
        lines.push('#EXT-X-DISCONTINUITY');
      }

      lines.push(`#EXTINF:${dur.toFixed(3)},`);
      lines.push(`${baseUrl}/api/smooth/${channelId}/segments/${seg.segment_name}?t=${token}`);

      previousSource = seg.source_type || previousSource;
      previousSeq = seg.sequence_number;
    }

    // Round target duration up to the nearest integer second (HLS spec)
    const targetDuration = Math.max(1, Math.ceil(maxDuration));
    // Insert TARGETDURATION after VERSION (position 2)
    lines.splice(2, 0, `#EXT-X-TARGETDURATION:${targetDuration}`);

    // Per work.md: never include #EXT-X-PLAYLIST-TYPE:EVENT — this is rolling delayed live.

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('serveMediaPlaylist error:', err);
    res.status(500).send('Error generating media playlist');
  }
};

// ── Serve cached .ts segment ──────────────────────────────────────────────────

exports.serveSegment = async (req, res) => {
  try {
    const { channelId, segmentName } = req.params;
    const token = req.query.t;
    try {
      const { verifySmoothToken } = require('../utils/jwt');
      verifySmoothToken(token, channelId);
    } catch (err) {
      return res.status(401).send('Unauthorized');
    }

    // Sanitize segment name — only allow safe filenames
    if (!/^seg_\d{6}\.ts$/.test(segmentName)) {
      return res.status(400).send('Invalid segment name');
    }

    const filePath = path.join(STORAGE_BASE, String(channelId), segmentName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Segment not found');
    }

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('serveSegment error:', err);
    res.status(500).send('Error serving segment');
  }
};

// ── Admin: list all channels with smooth playback info ────────────────────────

exports.adminListChannels = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];
    let pi = 1;

    if (status) {
      conditions.push(`c.buffer_status = $${pi++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`c.name ILIKE $${pi++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, dataRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM channels c ${where}`, params),
      db.query(
        `SELECT c.id, c.name, c.health_status,
                c.smooth_playback_enabled, c.playback_delay_seconds,
                c.buffer_status, c.buffer_depth_seconds, c.is_buffer_ready,
                c.restream_mode, c.last_buffer_error,
                c.recorder_stream_url, c.recorder_stream_id, c.recorder_fail_count,
                c.recorder_last_success_at, c.recorder_last_failure_at,
                c.recorder_last_failure_reason, c.recorder_backup_attempts,
                c.recorder_status_detail, c.recorder_failed_stream_url, c.recorder_backup_stream_url,
                c.needs_manual_verification,
                c.gap_handling_mode, c.allow_skip_missing_segments,
                c.missing_segment_count, c.skipped_segment_count, c.recovered_segment_count,
                c.backup_segment_count, c.lower_quality_segment_count,
                c.clean_buffer_percentage, c.buffer_quality_status,
                c.total_expected_segments, c.downloaded_segments,
                c.last_missing_segment_at, c.last_successful_segment_at,
                c.last_source_error, c.active_recorder_stream_id, c.backup_active,
                (SELECT COUNT(*) FROM delayed_buffer_segments WHERE channel_id = c.id)::int as segment_count,
                (SELECT COUNT(*) FROM delayed_buffer_segments WHERE channel_id = c.id AND segment_status = 'good')::int as good_segment_count,
                (SELECT COUNT(*) FROM delayed_buffer_segments WHERE channel_id = c.id AND segment_status = 'missing')::int as missing_segment_count_db
         FROM channels c ${where}
         ORDER BY c.smooth_playback_enabled DESC, c.name ASC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, parseInt(limit), offset]
      ),
    ]);

    const activeRecorders = bufferRecorder.getActiveRecorders();

    const data = dataRes.rows.map(ch => ({
      ...ch,
      recorder_active: activeRecorders.includes(ch.id),
    }));

    success(res, {
      channels: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRes.rows[0].count),
      },
      active_recorder_count: activeRecorders.length,
      max_recorders: parseInt(process.env.MAX_CONCURRENT_RECORDERS || '5'),
    });
  } catch (err) {
    console.error('adminListChannels error:', err);
    error(res, 'Failed to list channels', 500);
  }
};

// ── Admin: update smooth playback settings for a channel ─────────────────────

exports.adminUpdateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      smooth_playback_enabled,
      playback_delay_seconds,
      restream_mode,
      gap_handling_mode,
      allow_skip_missing_segments,
      max_missing_segments_allowed,
      min_clean_buffer_percentage,
    } = req.body;

    // Validate delay range
    if (playback_delay_seconds !== undefined) {
      const delay = parseInt(playback_delay_seconds);
      if (delay < 120 || delay > 600) {
        return error(res, 'playback_delay_seconds must be between 120 and 600', 400);
      }
    }

    // Validate gap_handling_mode
    if (gap_handling_mode !== undefined && !GAP_MODES.has(gap_handling_mode)) {
      return error(res, `gap_handling_mode must be one of: ${[...GAP_MODES].join(', ')}`, 400);
    }

    if (min_clean_buffer_percentage !== undefined) {
      const pct = parseInt(min_clean_buffer_percentage);
      if (pct < 0 || pct > 100) {
        return error(res, 'min_clean_buffer_percentage must be 0–100', 400);
      }
    }

    if (max_missing_segments_allowed !== undefined) {
      const m = parseInt(max_missing_segments_allowed);
      if (m < 1 || m > 1000) {
        return error(res, 'max_missing_segments_allowed must be 1–1000', 400);
      }
    }

    // Check channel is not DRM/geo-blocked before enabling
    if (smooth_playback_enabled === true) {
      const chRes = await db.query('SELECT health_status FROM channels WHERE id = $1', [id]);
      if (chRes.rows.length === 0) return error(res, 'Channel not found', 404);
      if (BLOCKED_STATUSES.has(chRes.rows[0].health_status)) {
        return error(res, `Cannot enable smooth playback: channel status is "${chRes.rows[0].health_status}"`, 400);
      }
    }

    const setClauses = [];
    const params = [];
    let pi = 1;

    if (smooth_playback_enabled !== undefined) { setClauses.push(`smooth_playback_enabled = $${pi++}`); params.push(smooth_playback_enabled); }
    if (playback_delay_seconds !== undefined)  { setClauses.push(`playback_delay_seconds = $${pi++}`); params.push(parseInt(playback_delay_seconds)); }
    if (restream_mode !== undefined)           { setClauses.push(`restream_mode = $${pi++}`); params.push(restream_mode); }
    if (gap_handling_mode !== undefined)       { setClauses.push(`gap_handling_mode = $${pi++}`); params.push(gap_handling_mode); }
    if (allow_skip_missing_segments !== undefined) { setClauses.push(`allow_skip_missing_segments = $${pi++}`); params.push(allow_skip_missing_segments); }
    if (max_missing_segments_allowed !== undefined) { setClauses.push(`max_missing_segments_allowed = $${pi++}`); params.push(parseInt(max_missing_segments_allowed)); }
    if (min_clean_buffer_percentage !== undefined) { setClauses.push(`min_clean_buffer_percentage = $${pi++}`); params.push(parseInt(min_clean_buffer_percentage)); }

    if (setClauses.length === 0) return error(res, 'No fields to update', 400);

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE channels SET ${setClauses.join(', ')} WHERE id = $${pi}
       RETURNING id, name, smooth_playback_enabled, playback_delay_seconds, restream_mode, gap_handling_mode,
                 allow_skip_missing_segments, max_missing_segments_allowed, min_clean_buffer_percentage, buffer_status`,
      params
    );

    if (result.rows.length === 0) return error(res, 'Channel not found', 404);

    const updated = result.rows[0];

    // Start or stop recorder based on new settings
    if (updated.smooth_playback_enabled && updated.restream_mode !== 'direct') {
      await bufferRecorder.startRecorder(parseInt(id));
    } else {
      await bufferRecorder.stopRecorder(parseInt(id));
      // Reset buffer state
      await db.query(
        `UPDATE channels SET buffer_status = 'stopped', is_buffer_ready = false, buffer_depth_seconds = 0 WHERE id = $1`,
        [id]
      );
    }

    success(res, updated);
  } catch (err) {
    console.error('adminUpdateChannel error:', err);
    error(res, 'Failed to update channel', 500);
  }
};

// ── Admin: restart recorder for a channel ────────────────────────────────────

exports.adminRestartRecorder = async (req, res) => {
  try {
    const { id } = req.params;
    await bufferRecorder.stopRecorder(parseInt(id));
    await new Promise(r => setTimeout(r, 500));
    await bufferRecorder.startRecorder(parseInt(id));
    success(res, { message: 'Recorder restarted', channel_id: parseInt(id) });
  } catch (err) {
    console.error('adminRestartRecorder error:', err);
    error(res, 'Failed to restart recorder', 500);
  }
};

// ── Admin: get buffer health summary ─────────────────────────────────────────

exports.adminBufferHealth = async (req, res) => {
  try {
    const statsRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE smooth_playback_enabled = true)::int as enabled_count,
         COUNT(*) FILTER (WHERE is_buffer_ready = true)::int as ready_count,
         COUNT(*) FILTER (WHERE buffer_status = 'warming_up')::int as warming_count,
         COUNT(*) FILTER (WHERE buffer_status = 'low_buffer')::int as low_buffer_count,
         COUNT(*) FILTER (WHERE buffer_status IN ('source_offline', 'no_working_source'))::int as offline_count,
         COUNT(*) FILTER (WHERE buffer_status IN ('error', 'segment_missing'))::int as error_count,
         COUNT(*) FILTER (WHERE buffer_status = 'retrying' OR recorder_status_detail LIKE 'retry_attempt_%')::int as retrying_count,
         COUNT(*) FILTER (WHERE buffer_status = 'trying_backup' OR recorder_status_detail = 'searching_backup_stream')::int as searching_backup_count,
         COUNT(*) FILTER (WHERE buffer_status = 'backup_active' OR recorder_status_detail = 'backup_active')::int as backup_active_count,
         COUNT(*) FILTER (WHERE recorder_status_detail = 'needs_manual_verification')::int as needs_verification_count,
         COALESCE(SUM(recorder_backup_attempts) FILTER (WHERE smooth_playback_enabled = true), 0)::int as total_backup_switches,
         COALESCE(AVG(buffer_depth_seconds) FILTER (WHERE smooth_playback_enabled = true), 0)::int as avg_depth_seconds,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'clean_buffer')::int as clean_buffer_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'minor_gaps')::int as minor_gaps_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'gap_repaired')::int as gap_repaired_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'skipping_missing_segments')::int as skipping_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'using_backup_segments')::int as using_backup_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'using_lower_quality_segments')::int as using_lower_quality_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'too_many_missing_segments')::int as too_many_missing_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'source_timeout')::int as source_timeout_count,
         COUNT(*) FILTER (WHERE buffer_quality_status = 'source_dead' OR buffer_quality_status = 'no_working_source')::int as source_dead_count,
         COUNT(*) FILTER (WHERE gap_handling_mode = 'skip_missing_chunks')::int as skip_mode_count,
         COUNT(*) FILTER (WHERE gap_handling_mode = 'black_filler')::int as black_filler_count,
         COUNT(*) FILTER (WHERE gap_handling_mode = 'strict_stop')::int as strict_stop_count,
         COUNT(*) FILTER (WHERE backup_active = true)::int as backup_active_channels,
         COALESCE(AVG(clean_buffer_percentage) FILTER (WHERE smooth_playback_enabled = true), 0)::int as avg_clean_buffer_pct,
         COALESCE(SUM(missing_segment_count) FILTER (WHERE smooth_playback_enabled = true), 0)::int as total_missing_segments,
         COALESCE(SUM(skipped_segment_count) FILTER (WHERE smooth_playback_enabled = true), 0)::int as total_skipped_segments,
         COALESCE(SUM(recovered_segment_count) FILTER (WHERE smooth_playback_enabled = true), 0)::int as total_recovered_segments,
         COALESCE(SUM(backup_segment_count) FILTER (WHERE smooth_playback_enabled = true), 0)::int as total_backup_segments
       FROM channels`
    );

    const activeRecorders = bufferRecorder.getActiveRecorders();
    const maxRecorders = parseInt(process.env.MAX_CONCURRENT_RECORDERS || '5');

    success(res, {
      ...statsRes.rows[0],
      active_recorders: activeRecorders.length,
      max_recorders: maxRecorders,
    });
  } catch (err) {
    console.error('adminBufferHealth error:', err);
    error(res, 'Failed to get buffer health', 500);
  }
};

// ── Admin: test segment download for a channel ───────────────────────────────

exports.adminTestSegmentDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const fetch = require('node-fetch');

    const chRes = await db.query(
      'SELECT id, name, recorder_stream_url, stream_url FROM channels WHERE id = $1',
      [id]
    );
    if (chRes.rows.length === 0) return error(res, 'Channel not found', 404);
    const ch = chRes.rows[0];

    const m3u8Url = ch.recorder_stream_url || ch.stream_url;
    if (!m3u8Url) return error(res, 'No stream URL available', 400);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(m3u8Url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 NivaTV/1.0' },
      }).finally(() => clearTimeout(timeoutId));

      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      const text = (await response.text()).slice(0, 500);

      const hasSeq = /#EXT-X-MEDIA-SEQUENCE:/.test(text);
      const segmentCount = (text.match(/#EXTINF:/g) || []).length;

      success(res, {
        channel_id: parseInt(id),
        http_status: status,
        content_type: contentType,
        has_media_sequence: hasSeq,
        segment_count_in_playlist: segmentCount,
        is_playable: response.ok && hasSeq && segmentCount > 0,
        preview: text,
      });
    } catch (fetchErr) {
      success(res, {
        channel_id: parseInt(id),
        is_playable: false,
        error: fetchErr.message || String(fetchErr),
      });
    }
  } catch (err) {
    console.error('adminTestSegmentDownload error:', err);
    error(res, 'Failed to test segment download', 500);
  }
};

// ── Admin: promote backup stream to primary for a channel ─────────────────────

exports.adminPromoteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const chRes = await db.query(
      'SELECT id, recorder_stream_url, recorder_backup_stream_url, recorder_stream_id FROM channels WHERE id = $1',
      [id]
    );
    if (chRes.rows.length === 0) return error(res, 'Channel not found', 404);
    const ch = chRes.rows[0];

    if (!ch.recorder_stream_url) {
      return error(res, 'No current primary stream to promote from', 400);
    }

    // Find a candidate backup stream from channel_streams
    const backupRes = await db.query(
      `UPDATE channels
       SET recorder_stream_url = $2,
           recorder_stream_id = $3,
           recorder_backup_stream_url = NULL,
           backup_active = true,
           recorder_status_detail = 'backup_active',
           buffer_status = 'backup_active',
           recorder_fail_count = 0,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, recorder_stream_url, recorder_stream_id`,
      [id, ch.recorder_stream_url, ch.recorder_stream_id]
    );

    // Restart recorder to use the new stream
    await bufferRecorder.stopRecorder(parseInt(id));
    await new Promise(r => setTimeout(r, 500));
    await bufferRecorder.startRecorder(parseInt(id));

    success(res, { message: 'Backup promoted to primary', channel: backupRes.rows[0] });
  } catch (err) {
    console.error('adminPromoteBackup error:', err);
    error(res, 'Failed to promote backup', 500);
  }
};

// ── Admin: reset buffer health counters for a channel ─────────────────────────

exports.adminResetBufferCounters = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE channels
       SET missing_segment_count = 0,
           skipped_segment_count = 0,
           recovered_segment_count = 0,
           backup_segment_count = 0,
           lower_quality_segment_count = 0,
           total_expected_segments = 0,
           downloaded_segments = 0,
           clean_buffer_percentage = 100,
           buffer_quality_status = 'clean_buffer',
           last_source_error = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    success(res, { message: 'Buffer counters reset', channel_id: parseInt(id) });
  } catch (err) {
    console.error('adminResetBufferCounters error:', err);
    error(res, 'Failed to reset counters', 500);
  }
};

// ── Admin: get fallback logs for a channel ───────────────────────────────────

exports.adminGetFallbackLogs = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 20 } = req.query;

    const result = await db.query(
      `SELECT id, from_stream_id, to_stream_id, result, notes, created_at
       FROM recorder_fallback_log
       WHERE channel_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [channelId, parseInt(limit)]
    );

    success(res, { logs: result.rows });
  } catch (err) {
    console.error('adminGetFallbackLogs error:', err);
    error(res, 'Failed to get fallback logs', 500);
  }
};

// ── Admin: force clear stale buffer ──────────────────────────────────────────

exports.adminClearStaleBuffer = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE channels
       SET recorder_stale_buffer_until = NULL,
           recorder_fail_count = 0,
           buffer_status = CASE
             WHEN buffer_status = 'source_timeout' THEN 'buffer_ready'
             ELSE buffer_status
           END
       WHERE id = $1`,
      [id]
    );

    success(res, { message: 'Stale buffer cleared', channel_id: parseInt(id) });
  } catch (err) {
    console.error('adminClearStaleBuffer error:', err);
    error(res, 'Failed to clear stale buffer', 500);
  }
};

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

const STORAGE_BASE = process.env.BUFFER_STORAGE_PATH
  || path.join(__dirname, '../../storage/buffers');

// Health statuses that must never be buffered
const BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);

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
              is_hidden, is_removed
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
        message: 'This channel requires a licensed source and cannot be buffered.',
      });
    }

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
      });
    }

    const delayedUrl = `${baseUrl}/api/smooth/${id}/playlist.m3u8`;

    // Buffer not ready yet — start on-demand if not already running
    if (!ch.is_buffer_ready) {
      const active = bufferRecorder.getActiveRecorders();
      if (!active.includes(parseInt(id)) && !BLOCKED_STATUSES.has(ch.health_status)) {
        bufferRecorder.startRecorder(parseInt(id)).catch(() => {});
      }

      return success(res, {
        playback_mode: 'delayed',
        delay_seconds: ch.playback_delay_seconds || 300,
        delayed_stream_url: delayedUrl,
        buffer_ready: false,
        buffer_depth_seconds: ch.buffer_depth_seconds || 0,
        buffer_status: ch.buffer_status || 'warming_up',
        primary_stream_id: parseInt(id),
        health_status: ch.health_status || 'unknown',
        message: 'Preparing smooth playback...',
        fallback_direct_url: ch.stream_url,
      });
    }

    return success(res, {
      playback_mode: 'delayed',
      delay_seconds: ch.playback_delay_seconds || 300,
      delayed_stream_url: delayedUrl,
      buffer_ready: true,
      buffer_depth_seconds: ch.buffer_depth_seconds || 0,
      buffer_status: ch.buffer_status || 'ready',
      primary_stream_id: parseInt(id),
      health_status: ch.health_status || 'unknown',
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

    const mediaUrl = `${baseUrl}/api/smooth/${channelId}/media.m3u8`;

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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    // Get channel config
    const chRes = await db.query(
      `SELECT playback_delay_seconds, is_buffer_ready, buffer_status FROM channels WHERE id = $1`,
      [channelId]
    );
    if (chRes.rows.length === 0) return res.status(404).send('Channel not found');

    const ch = chRes.rows[0];
    const delaySeconds = ch.playback_delay_seconds || 300;

    // Get segments within the delayed window
    // We serve segments that are older than delay_seconds (already buffered)
    const cutoffTime = new Date(Date.now() - delaySeconds * 1000).toISOString();

    const segsRes = await db.query(
      `SELECT segment_name, sequence_number, duration
       FROM delayed_buffer_segments
       WHERE channel_id = $1 AND created_at <= $2
       ORDER BY sequence_number ASC
       LIMIT 30`,
      [channelId, cutoffTime]
    );

    if (segsRes.rows.length === 0) {
      return res.status(503).send('Buffer not ready');
    }

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      `#EXT-X-MEDIA-SEQUENCE:${segsRes.rows[0].sequence_number}`,
    ];

    for (const seg of segsRes.rows) {
      lines.push(`#EXTINF:${parseFloat(seg.duration).toFixed(3)},`);
      lines.push(`${baseUrl}/api/smooth/${channelId}/segments/${seg.segment_name}`);
    }

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
                (SELECT COUNT(*) FROM delayed_buffer_segments WHERE channel_id = c.id)::int as segment_count
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
    } = req.body;

    // Validate delay range
    if (playback_delay_seconds !== undefined) {
      const delay = parseInt(playback_delay_seconds);
      if (delay < 120 || delay > 600) {
        return error(res, 'playback_delay_seconds must be between 120 and 600', 400);
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

    if (setClauses.length === 0) return error(res, 'No fields to update', 400);

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE channels SET ${setClauses.join(', ')} WHERE id = $${pi}
       RETURNING id, name, smooth_playback_enabled, playback_delay_seconds, restream_mode, buffer_status`,
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
         COUNT(*) FILTER (WHERE buffer_status = 'ready')::int as ready_count,
         COUNT(*) FILTER (WHERE buffer_status = 'warming_up')::int as warming_count,
         COUNT(*) FILTER (WHERE buffer_status = 'low_buffer')::int as low_buffer_count,
         COUNT(*) FILTER (WHERE buffer_status = 'segment_missing')::int as segment_missing_count,
         COUNT(*) FILTER (WHERE buffer_status = 'source_offline')::int as offline_count,
         COUNT(*) FILTER (WHERE buffer_status = 'error')::int as error_count,
         COALESCE(AVG(buffer_depth_seconds) FILTER (WHERE smooth_playback_enabled = true), 0)::int as avg_depth_seconds
       FROM channels`
    );

    const activeRecorders = bufferRecorder.getActiveRecorders();

    success(res, {
      ...statsRes.rows[0],
      active_recorders: activeRecorders.length,
      max_recorders: parseInt(process.env.MAX_CONCURRENT_RECORDERS || '5'),
    });
  } catch (err) {
    console.error('adminBufferHealth error:', err);
    error(res, 'Failed to get buffer health', 500);
  }
};

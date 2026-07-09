/**
 * streamHealthController.js
 * Admin: Stream Health Dashboard API
 *
 * Provides paginated stream health data, manual mark/hide actions,
 * and on-demand recheck using the existing streamDiagnoser utility.
 *
 * Uses only confirmed real DB columns from migrations 001–031.
 */

const db = require('../config/db');
const streamDiagnoser = require('../utils/streamDiagnoser');
const { success, error } = require('../utils/response');

// Health statuses that indicate a channel needs manual review
const NEEDS_REVIEW_STATUSES = [
  'unstable', 'needs_review', 'likely_broken', 'offline', 'dead',
  'forbidden_403', 'geo_blocked', 'drm_or_unsupported',
  'requires_licensed_source', 'unknown',
];

// ── GET /api/admin/stream-health ─────────────────────────────────────────────
// Returns paginated channel + primary stream health data for admin dashboard.
// Query params:
//   status      — filter by channel health_status (optional)
//   needs_check — 'true' to show only channels needing manual verification
//   page        — page number (default 1)
//   limit       — per page (default 50, max 200)
//   search      — filter by channel name (optional)
exports.getStreamHealth = async (req, res) => {
  try {
    const {
      status,
      needs_check,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE conditions — use only real confirmed columns
    const conditions = ['c.is_removed IS NOT TRUE'];  // never show hard-deleted channels
    const params = [];
    let pi = 1; // param index

    if (status) {
      conditions.push(`c.health_status = $${pi++}`);
      params.push(status);
    }
    if (needs_check === 'true') {
      conditions.push(`c.needs_manual_verification = true`);
    }
    if (search && search.trim()) {
      conditions.push(`c.name ILIKE $${pi++}`);
      params.push(`%${search.trim()}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Count total for pagination
    const countRes = await db.query(
      `SELECT COUNT(*) FROM channels c ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Main query — joins with primary stream and categories
    // All columns are from confirmed migrations
    const dataRes = await db.query(`
      SELECT
        c.id,
        c.name,
        c.health_status,
        c.health_score,
        c.health_reason,
        c.fail_count,
        c.last_failure_at,
        c.last_success_at,
        c.last_checked_at,
        c.failure_reason,
        c.is_featured,
        c.is_popular,
        c.is_premium,
        c.is_paid,
        c.is_hidden,
        c.is_removed,
        c.is_visible_app,
        c.is_visible_website,
        c.needs_manual_verification,
        c.admin_note,
        c.playback_mode      AS channel_playback_mode,
        c.user_agent         AS channel_user_agent,
        c.referrer           AS channel_referrer,
        c.stream_url         AS channel_stream_url,
        c.backup_stream_url,
        cat.name             AS category_name,
        -- Primary stream columns (lowest priority, not hidden)
        cs.id                AS stream_id,
        cs.stream_url        AS primary_stream_url,
        cs.quality           AS stream_quality,
        cs.priority          AS stream_priority,
        cs.health_status     AS stream_health,
        cs.health_score      AS stream_score,
        cs.health_reason     AS stream_health_reason,
        cs.fail_count        AS stream_fail_count,
        cs.success_count     AS stream_success_count,
        cs.last_failed_at    AS stream_last_failed_at,
        cs.last_success_at   AS stream_last_success_at,
        cs.last_checked_at   AS stream_last_checked_at,
        cs.final_url,
        cs.codec_video,
        cs.codec_audio,
        cs.user_agent        AS stream_user_agent,
        cs.referer           AS stream_referer,
        cs.headers_json,
        cs.vlc_playable,
        cs.android_playable,
        cs.playback_mode     AS stream_playback_mode,
        cs.license_type,
        cs.resolution_height,
        cs.bitrate,
        cs.is_primary        AS stream_is_primary,
        -- Aggregate counts
        (SELECT COUNT(*) FROM channel_streams cs2
         WHERE cs2.channel_id = c.id AND cs2.is_hidden IS NOT TRUE
        )::int               AS total_streams,
        (SELECT COUNT(*) FROM channel_reports cr
         WHERE cr.channel_id = c.id
           AND cr.created_at > NOW() - INTERVAL '7 days'
        )::int               AS recent_reports_7d
      FROM channels c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN channel_streams cs
        ON cs.channel_id = c.id
        AND cs.is_primary = true
        AND cs.is_hidden IS NOT TRUE
      ${where}
      ORDER BY
        c.health_score ASC NULLS FIRST,
        c.fail_count DESC NULLS LAST,
        c.last_failure_at DESC NULLS LAST,
        c.name ASC
      LIMIT $${pi} OFFSET $${pi + 1}
    `, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: offset + dataRes.rows.length < total,
      },
    });
  } catch (err) {
    console.error('[streamHealth] getStreamHealth error:', err);
    return error(res, 'Failed to fetch stream health data', 500);
  }
};

// ── POST /api/admin/stream-health/:channelId/mark ───────────────────────────
// Admin marks a channel with a specific action.
// Body: { action, note }
// Actions:
//   mark_working            — set health_status=online, clear fail_count
//   mark_unstable           — set health_status=unstable
//   requires_licensed_source— mark as DRM/unlicensed (not a stream problem)
//   hide_app                — hide from app only (is_hidden=true, is_visible_app=false)
//   hide_website            — hide from website only
//   hide_everywhere         — hide from app + website
//   restore                 — un-hide, restore visibility
//   clear_verification      — clear needs_manual_verification flag
//   set_note                — update admin_note only
exports.markStreamStatus = async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return error(res, 'Invalid channel ID', 400);

    const { action, note } = req.body;
    if (!action) return error(res, 'action is required', 400);

    // Verify channel exists
    const chanRes = await db.query(
      'SELECT id, name, is_featured, is_popular, is_premium, health_status FROM channels WHERE id = $1',
      [channelId]
    );
    if (chanRes.rows.length === 0) return error(res, 'Channel not found', 404);
    const channel = chanRes.rows[0];

    // Build the UPDATE fields based on action
    const updates = {};
    let auditDetails = {};

    switch (action) {
      case 'mark_working':
        updates.health_status            = 'online';
        updates.health_score             = 85;
        updates.fail_count               = 0;
        updates.needs_manual_verification = false;
        auditDetails = { from: channel.health_status, to: 'online' };
        break;

      case 'mark_unstable':
        updates.health_status            = 'unstable';
        updates.needs_manual_verification = false;
        auditDetails = { from: channel.health_status, to: 'unstable' };
        break;

      case 'requires_licensed_source':
        updates.health_status            = 'requires_licensed_source';
        updates.is_visible_app           = false;
        updates.needs_manual_verification = false;
        auditDetails = { from: channel.health_status, to: 'requires_licensed_source' };
        break;

      case 'hide_app':
        updates.is_hidden     = true;
        updates.is_visible_app = false;
        updates.hidden_reason = note || 'Admin hidden from app';
        updates.hidden_at     = new Date().toISOString();
        auditDetails = { visibility: 'hidden_app' };
        break;

      case 'hide_website':
        updates.is_visible_website = false;
        updates.hidden_reason      = note || 'Admin hidden from website';
        auditDetails = { visibility: 'hidden_website' };
        break;

      case 'hide_everywhere':
        updates.is_hidden          = true;
        updates.is_visible_app     = false;
        updates.is_visible_website = false;
        updates.hidden_reason      = note || 'Admin hidden everywhere';
        updates.hidden_at          = new Date().toISOString();
        auditDetails = { visibility: 'hidden_everywhere' };
        break;

      case 'restore':
        updates.is_hidden          = false;
        updates.is_removed         = false;
        updates.is_visible_app     = true;
        updates.is_visible_website = true;
        updates.hidden_reason      = null;
        updates.needs_manual_verification = false;
        auditDetails = { restored: true };
        break;

      case 'clear_verification':
        updates.needs_manual_verification = false;
        auditDetails = { cleared: 'needs_manual_verification' };
        break;

      case 'set_note':
        // note-only update — no status change
        auditDetails = { note_set: true };
        break;

      default:
        return error(res, `Unknown action: ${action}`, 400);
    }

    // Apply admin_note if provided (for any action)
    if (note !== undefined) {
      updates.admin_note = note || null;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
      const values = [channelId, ...Object.values(updates)];
      await db.query(
        `UPDATE channels SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1`,
        values
      );
    }

    // ── Audit log ────────────────────────────────────────────────────────────
    const adminId = req.adminUser?.id || req.user?.id || null;
    await db.query(`
      INSERT INTO admin_audit_logs
        (admin_id, action, target_type, target_id, details, ip_address)
      VALUES ($1, $2, 'channel', $3, $4, $5)
    `, [
      adminId,
      `stream_health_${action}`,
      channelId,
      JSON.stringify({ channel_name: channel.name, reason: note || null, ...auditDetails, updates }),
      req.ip || null,
    ]);

    return success(res, { success: true, action, channel_id: channelId });
  } catch (err) {
    console.error('[streamHealth] markStreamStatus error:', err);
    return error(res, 'Failed to update channel status', 500);
  }
};

// ── POST /api/admin/stream-health/:channelId/recheck ────────────────────────
// Runs streamDiagnoser on the channel's primary stream and updates health fields.
exports.recheckStream = async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return error(res, 'Invalid channel ID', 400);

    // Fetch channel + primary stream
    const chanRes = await db.query(`
      SELECT
        c.id, c.name, c.stream_url, c.user_agent AS c_ua, c.referrer AS c_referer,
        cs.id AS cs_id, cs.stream_url AS cs_url,
        cs.user_agent AS cs_ua, cs.referer AS cs_referer,
        cs.headers_json
      FROM channels c
      LEFT JOIN channel_streams cs
        ON cs.channel_id = c.id
        AND cs.is_primary = true
        AND cs.is_hidden IS NOT TRUE
      WHERE c.id = $1
    `, [channelId]);

    if (chanRes.rows.length === 0) return error(res, 'Channel not found', 404);
    const row = chanRes.rows[0];

    const urlToCheck = row.cs_url || row.stream_url;
    if (!urlToCheck) return error(res, 'No stream URL to check', 400);

    const headers = {};
    const ua = row.cs_ua || row.c_ua;
    const referer = row.cs_referer || row.c_referer;
    if (ua)      headers['User-Agent'] = ua;
    if (referer) headers['Referer']    = referer;
    if (row.headers_json && typeof row.headers_json === 'object') {
      Object.assign(headers, row.headers_json);
    }

    // Run the deep stream diagnosis (uses existing streamDiagnoser utility)
    let diagResult;
    try {
      diagResult = await streamDiagnoser.diagnoseStream(urlToCheck, headers);
    } catch (diagErr) {
      diagResult = {
        status: 'unknown',
        healthScore: 50,
        healthReason: `Diagnoser error: ${diagErr.message}`,
      };
    }

    const newStatus    = diagResult.status      || 'unknown';
    const newScore     = diagResult.healthScore ?? 50;
    const newReason    = diagResult.healthReason || null;
    const now          = new Date();

    // Update channel_streams if we have a primary stream record
    if (row.cs_id) {
      await db.query(`
        UPDATE channel_streams
        SET health_status   = $1,
            health_score    = $2,
            health_reason   = $3,
            last_checked_at = $4
        WHERE id = $5
      `, [newStatus, newScore, newReason, now, row.cs_id]);
    }

    // Update channels table
    await db.query(`
      UPDATE channels
      SET health_status   = $1,
          health_score    = $2,
          health_reason   = $3,
          last_checked_at = $4
      WHERE id = $5
    `, [newStatus, newScore, newReason, now, channelId]);

    // Audit log
    const adminId = req.adminUser?.id || req.user?.id || null;
    await db.query(`
      INSERT INTO admin_audit_logs
        (admin_id, action, target_type, target_id, details, ip_address)
      VALUES ($1, 'stream_health_recheck', 'channel', $2, $3, $4)
    `, [
      adminId, channelId,
      JSON.stringify({ new_status: newStatus, new_score: newScore, reason: newReason }),
      req.ip || null,
    ]);

    return success(res, {
      channel_id: channelId,
      health_status: newStatus,
      health_score: newScore,
      health_reason: newReason,
      checked_at: now,
      raw: diagResult,
    });
  } catch (err) {
    console.error('[streamHealth] recheckStream error:', err);
    return error(res, 'Failed to recheck stream', 500);
  }
};

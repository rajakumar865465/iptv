const db = require('../config/db');
const { success, error } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');

exports.getBrokenChannels = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category_id, search, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;
    
    // We only show channels that are NOT removed or hidden in this list. 
    // Wait, if it's broken, we want to see it even if it's hidden?
    // Actually, usually we only scan visible channels, but let's exclude removed ones.
    let conditions = [`c.is_removed = false`];
    let params = [];
    
    if (status) {
      if (status === 'needs_review') {
        conditions.push(`c.needs_manual_verification = true`);
      } else {
        conditions.push(`c.health_status = $${params.length + 1}`);
        params.push(status);
      }
    } else {
      // Default: show problematic ones
      conditions.push(`(c.health_status IN ('offline', 'unstable', 'error', 'timeout', 'forbidden_403', 'geo_blocked', 'drm_or_unsupported', 'segment_failed') OR c.status = 'offline' OR c.stream_url IS NULL OR c.stream_url = '' OR c.needs_manual_verification = true)`);
    }

    if (category_id) {
      conditions.push(`c.category_id = $${params.length + 1}`);
      params.push(category_id);
    }
    
    if (search) {
      conditions.push(`c.name ILIKE $${params.length + 1}`);
      params.push(`%${search}%`);
    }

    const whereStr = conditions.join(' AND ');
    
    let orderBy = 'c.fail_count DESC, c.last_failure_at DESC NULLS LAST';
    if (sort === 'fail_count') orderBy = 'c.fail_count DESC';
    if (sort === 'recent') orderBy = 'c.last_checked_at DESC NULLS LAST';

    const countResult = await db.query(`SELECT COUNT(*) FROM channels c WHERE ${whereStr}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT c.*, cat.name as category_name,
        (SELECT COUNT(*) FROM channel_streams cs WHERE cs.channel_id = c.id) as stream_count
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE ${whereStr}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    console.error('getBrokenChannels error:', err);
    error(res, 'Failed to fetch broken channels', 500);
  }
};

exports.fixChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE channels SET health_status = 'unknown', fail_count = 0, status = 'active', needs_manual_verification = false, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    // Also reset streams
    await db.query("UPDATE channel_streams SET health_status = 'unknown', fail_count = 0, health_score = 50 WHERE channel_id = $1", [id]);
    success(res, result.rows[0], 'Channel marked for re-check');
  } catch (err) {
    error(res, 'Failed to fix channel', 500);
  }
};

exports.verifyChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user.id;
    
    const result = await db.query(
      `UPDATE channels SET 
       health_status = COALESCE($1, health_status), 
       admin_note = $2, 
       needs_manual_verification = false, 
       updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [status, note, id]
    );
    
    await logAudit({
      admin_id: adminId, action: 'channel_verified', target_type: 'channel', target_id: id,
      new_value: { status, note },
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });
    
    success(res, result.rows[0], 'Channel verified');
  } catch (err) {
    console.error('verifyChannel error:', err);
    error(res, 'Failed to verify channel', 500);
  }
};

exports.bulkAction = async (req, res) => {
  try {
    const { ids, action, reason } = req.body;
    const adminId = req.user.id;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, 'No channels provided', 400);
    }
    
    let updated = 0;
    
    for (const id of ids) {
      if (action === 'recheck') {
        await db.query("UPDATE channels SET health_status = 'unknown', fail_count = 0, needs_manual_verification = false WHERE id = $1", [id]);
        await db.query("UPDATE channel_streams SET health_status = 'unknown', fail_count = 0, health_score = 50 WHERE channel_id = $1", [id]);
        updated++;
      } else if (action === 'hide') {
        const chRes = await db.query('SELECT * FROM channels WHERE id = $1', [id]);
        if (chRes.rows.length) {
          const ch = chRes.rows[0];
          await db.query("UPDATE channels SET is_hidden = true, hidden_reason = $1, hidden_at = NOW(), hidden_by_admin_id = $2 WHERE id = $3", [reason || 'Bulk hide', adminId, id]);
          // Blocklist
          await db.query(
            \`INSERT INTO channel_blocklist (source, source_channel_id, tvg_id, canonical_name, reason, admin_id)
             VALUES ($1, $2, $3, $4, $5, $6)\`,
            [ch.source || 'iptv-org', ch.source_channel_id, ch.tvg_id, ch.canonical_name, reason || 'Bulk hide', adminId]
          );
          updated++;
        }
      }
    }
    
    await logAudit({
      admin_id: adminId, action: 'channel_bulk_action', target_type: 'channel_batch', target_id: null,
      new_value: { action, count: updated, reason },
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });
    
    success(res, { count: updated }, \`Bulk action \${action} completed on \${updated} channels\`);
  } catch (err) {
    console.error('bulkAction error:', err);
    error(res, 'Bulk action failed', 500);
  }
};

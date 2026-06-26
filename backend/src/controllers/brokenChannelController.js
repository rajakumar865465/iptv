const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getBrokenChannels = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category_id } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [`(c.health_status IN ('offline', 'unstable', 'error', 'timeout', 'forbidden_403', 'geo_blocked', 'drm_or_unsupported', 'segment_failed') OR c.status = 'offline' OR c.stream_url IS NULL OR c.stream_url = '')`];
    let params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`c.health_status = $${paramIndex++}`);
      params.push(status);
    }
    if (category_id) {
      conditions.push(`c.category_id = $${paramIndex++}`);
      params.push(category_id);
    }

    const whereStr = conditions.join(' AND ');
    const countResult = await db.query(`SELECT COUNT(*) FROM channels c WHERE ${whereStr}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT c.*, cat.name as category_name,
        (SELECT COUNT(*) FROM channel_streams cs WHERE cs.channel_id = c.id) as stream_count
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE ${whereStr}
       ORDER BY c.fail_count DESC, c.last_failure_at DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch broken channels', 500);
  }
};

exports.fixChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE channels SET health_status = 'unknown', fail_count = 0, status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    success(res, result.rows[0], 'Channel marked for re-check');
  } catch (err) {
    error(res, 'Failed to fix channel', 500);
  }
};

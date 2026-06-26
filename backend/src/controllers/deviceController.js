const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getAllDevices = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, user_id, status } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (user_id) {
      conditions.push(`d.user_id = $${paramIndex++}`);
      params.push(user_id);
    }
    if (status) {
      conditions.push(`d.status = $${paramIndex++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(d.device_name ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR d.device_id ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await db.query(`SELECT COUNT(*) FROM devices d LEFT JOIN users u ON d.user_id = u.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT d.*, u.full_name as user_name, u.email as user_email, l.license_key
       FROM devices d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN licenses l ON d.license_id = l.id
       ${whereClause}
       ORDER BY d.last_active_at DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch devices', 500);
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM devices WHERE id = $1', [id]);
    success(res, null, 'Device removed');
  } catch (err) {
    error(res, 'Failed to remove device', 500);
  }
};

exports.updateDeviceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await db.query('UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
    success(res, result.rows[0], 'Device status updated');
  } catch (err) {
    error(res, 'Failed to update device', 500);
  }
};

const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getApiErrors = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const countResult = await db.query('SELECT COUNT(*) FROM api_error_logs');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query('SELECT * FROM api_error_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch API errors', 500);
  }
};

exports.getAdminActions = async (req, res) => {
  try {
    const { page = 1, limit = 50, admin_id } = req.query;
    const offset = (page - 1) * limit;
    let params = [];
    let whereStr = '';
    if (admin_id) {
      whereStr = 'WHERE l.admin_id = $1';
      params.push(admin_id);
    }
    const countQuery = 'SELECT COUNT(*) FROM admin_audit_logs ' + whereStr;
    const countResult = admin_id ? await db.query(countQuery, params) : await db.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);
    const queryStr = 'SELECT l.*, u.full_name as admin_name FROM admin??????_audit_logs l LEFT JOIN users u ON l.admin_id = u.id ' + whereStr + ' ORDER BY l.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    const result = await db.query(queryStr, [...params, limit, offset]);
    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch admin actions', 500);
  }
};

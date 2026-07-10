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
    const queryStr = 'SELECT l.*, u.full_name as admin_name FROM admin_audit_logs l LEFT JOIN users u ON l.admin_id = u.id ' + whereStr + ' ORDER BY l.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    const result = await db.query(queryStr, [...params, limit, offset]);
    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch admin actions', 500);
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, level, source, search } = req.query;
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT * FROM (
        SELECT 
          created_at as timestamp,
          'error' as level,
          'backend' as source,
          error_message as message,
          status_code as "statusCode",
          NULL::int as "channelId",
          user_id as "userId",
          path as "requestPath",
          request_body as "errorDetails"
        FROM api_error_logs
        
        UNION ALL
        
        SELECT
          created_at as timestamp,
          'info' as level,
          'admin' as source,
          'Admin action: ' || action as message,
          NULL::int as "statusCode",
          CASE WHEN target_type = 'channel' THEN target_id ELSE NULL END as "channelId",
          admin_id as "userId",
          NULL::varchar as "requestPath",
          jsonb_build_object('old', old_value, 'new', new_value, 'reason', reason) as "errorDetails"
        FROM admin_audit_logs
        
        UNION ALL
        
        SELECT
          created_at as timestamp,
          CASE WHEN status = 'failed' THEN 'error' WHEN status = 'completed' THEN 'success' ELSE 'info' END as level,
          'stream_scanner' as source,
          'Scanner job ' || status as message,
          NULL::int as "statusCode",
          NULL::int as "channelId",
          NULL::int as "userId",
          NULL::varchar as "requestPath",
          results as "errorDetails"
        FROM stream_scan_jobs
      ) unified_logs
    `;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (level && level !== 'all') {
      conditions.push(`level = $${paramIndex++}`);
      params.push(level);
    }
    if (source && source !== 'all') {
      conditions.push(`source = $${paramIndex++}`);
      params.push(source);
    }
    if (search) {
      conditions.push(`message ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) c`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `${baseQuery} ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const result = await db.query(dataQuery, [...params, limit, offset]);

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: offset + limit < total
      }
    });
  } catch (err) {
    console.error('getSystemLogs Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

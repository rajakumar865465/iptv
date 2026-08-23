const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getDashboardStats = async (req, res) => {
  try {
    const [userStats, channelStats, licenseStats, paymentStats, deviceStats, recentUsers, recentPayments, revenueSeries, deviceBreakdown] = await Promise.all([
      db.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_last_30d
        FROM users WHERE role = 'user'`),
      db.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE health_status = 'online') as online,
        COUNT(*) FILTER (WHERE health_status = 'offline') as offline,
        COUNT(*) FILTER (WHERE health_status = 'unstable') as unstable,
        COUNT(*) FILTER (WHERE status = 'merged') as merged
        FROM channels`),
      db.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unused') as unused,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended
        FROM licenses`),
      db.query(`SELECT
        COUNT(*) as total,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM payments`),
      db.query(`SELECT COUNT(*) as total FROM devices`),
      db.query(`SELECT id, full_name, email, created_at, status FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 5`),
      db.query(`SELECT p.id, p.amount, p.status, p.created_at, u.full_name, u.email
        FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5`),
      db.query(`
        WITH dates AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE, '1 day')::date AS date
        )
        SELECT 
          TO_CHAR(d.date, 'Mon DD') as name,
          COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as revenue,
          COUNT(DISTINCT u.id) as users
        FROM dates d
        LEFT JOIN payments p ON DATE(p.created_at) = d.date
        LEFT JOIN users u ON DATE(u.created_at) = d.date AND u.role = 'user'
        GROUP BY d.date
        ORDER BY d.date;
      `),
      db.query(`
        SELECT COALESCE(platform, 'Unknown') as name, COUNT(*) as value 
        FROM devices 
        GROUP BY COALESCE(platform, 'Unknown')
      `)
    ]);

    success(res, {
      users: userStats.rows[0],
      channels: channelStats.rows[0],
      licenses: licenseStats.rows[0],
      payments: paymentStats.rows[0],
      devices: deviceStats.rows[0],
      recentUsers: recentUsers.rows,
      recentPayments: recentPayments.rows,
      revenueSeries: revenueSeries.rows,
      deviceBreakdown: deviceBreakdown.rows.length > 0 ? deviceBreakdown.rows : [{name: 'Android', value: 1}, {name: 'iOS', value: 1}]
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    error(res, 'Failed to fetch dashboard stats', 500);
  }
};

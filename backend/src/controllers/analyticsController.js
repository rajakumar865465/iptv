const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getUserAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(`SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE role = 'user' AND created_at > NOW() - INTERVAL '${days} days' GROUP BY DATE(created_at) ORDER BY date`);
    const activeUsers = await db.query(`SELECT DATE(last_login_at) as date, COUNT(*) as count FROM users WHERE last_login_at > NOW() - INTERVAL '${days} days' GROUP BY DATE(last_login_at) ORDER BY date`);
    success(res, { signups: result.rows, active: activeUsers.rows });
  } catch (err) {
    error(res, 'Failed to fetch analytics', 500);
  }
};

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(`SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' AND created_at > NOW() - INTERVAL '${days} days' GROUP BY DATE(created_at) ORDER BY date`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch revenue analytics', 500);
  }
};

exports.getPlaybackAnalytics = async (req, res) => {
  try {
    const result = await db.query(`SELECT c.name, COUNT(*) as play_count FROM watch_history w JOIN channels c ON w.channel_id = c.id WHERE w.watched_at > NOW() - INTERVAL '30 days' GROUP BY c.id, c.name ORDER BY play_count DESC LIMIT 20`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch playback analytics', 500);
  }
};

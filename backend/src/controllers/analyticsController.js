const db = require('../config/db');
const { success, error } = require('../utils/response');

// BUG-08 FIX: Validate and whitelist the `days` param to prevent SQL injection.
// The INTERVAL clause cannot use parameterized placeholders in PostgreSQL,
// so we must sanitize the value before interpolation.
const ALLOWED_DAYS = [7, 14, 30, 60, 90, 180, 365];
function sanitizeDays(raw) {
  const n = parseInt(raw, 10);
  if (ALLOWED_DAYS.includes(n)) return n;
  return 30; // safe default
}

exports.getUserAnalytics = async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days);
    const [result, activeUsers] = await Promise.all([
      db.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM users WHERE role = 'user' AND created_at > NOW() - INTERVAL '1 day' * $1
         GROUP BY DATE(created_at) ORDER BY date`,
        [days]
      ),
      db.query(
        `SELECT DATE(last_login_at) as date, COUNT(*) as count
         FROM users WHERE last_login_at > NOW() - INTERVAL '1 day' * $1
         GROUP BY DATE(last_login_at) ORDER BY date`,
        [days]
      ),
    ]);
    success(res, { signups: result.rows, active: activeUsers.rows });
  } catch (err) {
    error(res, 'Failed to fetch analytics', 500);
  }
};

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days);
    const result = await db.query(
      `SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
       FROM payments WHERE status = 'completed' AND created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at) ORDER BY date`,
      [days]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch revenue analytics', 500);
  }
};

exports.getPlaybackAnalytics = async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days);
    const result = await db.query(`SELECT c.name, COUNT(*) as play_count
       FROM watch_history w JOIN channels c ON w.channel_id = c.id
       WHERE w.watched_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY c.id, c.name ORDER BY play_count DESC LIMIT 20`,
      [days]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch playback analytics', 500);
  }
};

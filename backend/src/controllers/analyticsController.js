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

exports.getWatchTimeAnalytics = async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days);

    // 1. Overall Summary
    const summaryRes = await db.query(`
      SELECT 
        COUNT(*) AS total_sessions,
        COALESCE(SUM(duration_seconds), 0) AS total_watch_seconds,
        COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0), 0) AS avg_session_seconds,
        COUNT(DISTINCT user_id) AS unique_viewers
      FROM stream_sessions
      WHERE started_at > NOW() - INTERVAL '1 day' * $1
        AND duration_seconds > 0
    `, [days]).catch(() => ({ rows: [{}] }));

    // 2. Daily Watch Hours Trend
    const trendRes = await db.query(`
      WITH dates AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '1 day' * $1, CURRENT_DATE, '1 day')::date AS date
      )
      SELECT 
        TO_CHAR(d.date, 'Mon DD') as name,
        d.date,
        ROUND(COALESCE(SUM(s.duration_seconds), 0) / 3600.0, 2) AS watch_hours,
        COUNT(s.id) AS sessions,
        COUNT(DISTINCT s.user_id) AS viewers
      FROM dates d
      LEFT JOIN stream_sessions s ON DATE(s.started_at) = d.date AND s.duration_seconds > 0
      GROUP BY d.date
      ORDER BY d.date;
    `, [days]).catch(() => ({ rows: [] }));

    // 3. Peak Viewing Hours (IST distribution 0-23)
    const peakRes = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM (s.started_at AT TIME ZONE 'Asia/Kolkata'))::INT AS hour,
        ROUND(COALESCE(SUM(s.duration_seconds), 0) / 3600.0, 1) AS watch_hours,
        COUNT(*) AS sessions
      FROM stream_sessions s
      WHERE s.started_at > NOW() - INTERVAL '1 day' * $1
        AND s.duration_seconds > 0
      GROUP BY hour
      ORDER BY hour;
    `, [days]).catch(() => ({ rows: [] }));

    // Fill all 24 hours
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = {
        hour: h,
        label: `${h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}`,
        watch_hours: 0,
        sessions: 0
      };
    }
    for (const row of peakRes.rows) {
      if (hourlyMap[row.hour] !== undefined) {
        hourlyMap[row.hour].watch_hours = parseFloat(row.watch_hours) || 0;
        hourlyMap[row.hour].sessions = parseInt(row.sessions) || 0;
      }
    }
    const peakHours = Object.values(hourlyMap);

    // 4. Top Channels by Watch Duration
    const topChannelsRes = await db.query(`
      SELECT 
        c.id, c.name, c.logo_url, cat.name AS category_name,
        COUNT(s.id) AS session_count,
        COUNT(DISTINCT s.user_id) AS unique_viewers,
        ROUND(COALESCE(SUM(s.duration_seconds), 0) / 3600.0, 2) AS watch_hours
      FROM stream_sessions s
      JOIN channels c ON s.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE s.started_at > NOW() - INTERVAL '1 day' * $1
        AND s.duration_seconds > 0
      GROUP BY c.id, c.name, c.logo_url, cat.name
      ORDER BY watch_hours DESC
      LIMIT 20;
    `, [days]).catch(() => ({ rows: [] }));

    // 5. Category Share
    const categoryRes = await db.query(`
      SELECT 
        COALESCE(cat.name, 'General') AS category_name,
        ROUND(COALESCE(SUM(s.duration_seconds), 0) / 3600.0, 2) AS watch_hours,
        COUNT(s.id) AS session_count
      FROM stream_sessions s
      JOIN channels c ON s.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE s.started_at > NOW() - INTERVAL '1 day' * $1
        AND s.duration_seconds > 0
      GROUP BY cat.name
      ORDER BY watch_hours DESC;
    `, [days]).catch(() => ({ rows: [] }));

    const rawSummary = summaryRes.rows[0] || {};
    const totalWatchSeconds = Number(rawSummary.total_watch_seconds || 0);
    const totalWatchHours = (totalWatchSeconds / 3600).toFixed(1);
    const uniqueViewers = parseInt(rawSummary.unique_viewers || 0, 10);
    const avgSessionMinutes = Math.round(Number(rawSummary.avg_session_seconds || 0) / 60);
    const avgHoursPerUser = uniqueViewers > 0 ? (parseFloat(totalWatchHours) / uniqueViewers).toFixed(1) : '0.0';

    success(res, {
      summary: {
        total_watch_hours: parseFloat(totalWatchHours),
        total_sessions: parseInt(rawSummary.total_sessions || 0, 10),
        unique_viewers: uniqueViewers,
        avg_session_minutes: avgSessionMinutes,
        avg_hours_per_user: parseFloat(avgHoursPerUser),
      },
      daily_trend: trendRes.rows,
      peak_hours: peakHours,
      top_channels: topChannelsRes.rows,
      category_share: categoryRes.rows,
    });
  } catch (err) {
    console.error('getWatchTimeAnalytics error:', err);
    error(res, 'Failed to fetch watch time analytics', 500);
  }
};

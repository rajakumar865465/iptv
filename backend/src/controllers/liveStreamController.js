const db = require('../config/db');
const { success, error } = require('../utils/response');

/**
 * Returns all users currently watching live TV.
 * Uses both active stream_sessions and recent device pings for 100% precision.
 */
exports.getLiveStreams = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COALESCE(s.id, 0) AS session_id,
        d.device_id,
        d.device_name,
        COALESCE(s.device_model, d.device_name) AS device_model,
        COALESCE(s.client_platform, d.platform, 'android') AS platform,
        COALESCE(s.app_version, d.app_version) AS app_version,
        COALESCE(s.ip_address, d.ip_address) AS ip_address,
        COALESCE(s.started_at, d.stream_started_at, d.last_stream_ping_at) AS started_at,
        d.last_stream_ping_at,
        d.last_active_at,
        GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(s.started_at, d.stream_started_at, d.last_stream_ping_at)))::INT) AS duration_seconds,
        GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(d.last_active_at, d.last_stream_ping_at, NOW())))::INT) AS seconds_since_active,
        CASE 
          WHEN d.last_stream_ping_at > NOW() - INTERVAL '75 seconds' AND d.active_channel_id IS NOT NULL THEN 'streaming'
          ELSE 'in_app'
        END AS activity_status,
        COALESCE(d.current_screen, 'Home') AS current_screen,
        u.id AS user_id,
        COALESCE(u.full_name, 'Anonymous Viewer') AS user_name,
        u.email AS user_email,
        u.mobile AS user_mobile,
        u.status AS user_status,
        c.id AS channel_id,
        c.name AS channel_name,
        c.channel_number,
        c.logo_url,
        cat.name AS category_name,
        l.license_key,
        p.name AS plan_name,
        l.status AS license_status
      FROM devices d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN channels c ON d.active_channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN stream_sessions s ON s.device_id = d.device_id AND s.is_active = TRUE
      LEFT JOIN licenses l ON d.license_id = l.id
      LEFT JOIN plans p ON l.plan_id = p.id
      WHERE (
        (d.last_stream_ping_at > NOW() - INTERVAL '75 seconds' AND d.active_channel_id IS NOT NULL)
        OR (d.last_active_at > NOW() - INTERVAL '2 minutes')
      )
      ORDER BY 
        CASE WHEN d.last_stream_ping_at > NOW() - INTERVAL '75 seconds' AND d.active_channel_id IS NOT NULL THEN 0 ELSE 1 END,
        COALESCE(d.last_stream_ping_at, d.last_active_at) DESC
    `);

    // Channel popularity among active streamers
    const channelCounts = {};
    let streamingCount = 0;
    let inAppCount = 0;

    for (const row of result.rows) {
      if (row.activity_status === 'streaming') {
        streamingCount++;
        const chName = row.channel_name || 'Unknown';
        channelCounts[chName] = (channelCounts[chName] || 0) + 1;
      } else {
        inAppCount++;
      }
    }

    const topLiveChannels = Object.entries(channelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    success(res, {
      total_viewers: streamingCount,
      total_online_users: result.rows.length,
      streaming_viewers: streamingCount,
      in_app_users: inAppCount,
      streams: result.rows,
      top_live_channels: topLiveChannels,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('getLiveStreams error:', err);
    error(res, 'Failed to fetch live streams', 500);
  }
};

/**
 * Admin action to remotely disconnect / terminate a live stream session.
 */
exports.killLiveStream = async (req, res) => {
  try {
    const { id } = req.params; // session_id or device_id

    // End active session by session_id or device_id
    const sessionRes = await db.query(`
      UPDATE stream_sessions
      SET is_active = FALSE,
          ended_at = NOW(),
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INT)
      WHERE (id::text = $1 OR device_id = $1) AND is_active = TRUE
      RETURNING id, device_id, user_id
    `, [id]);

    const deviceId = sessionRes.rows[0]?.device_id || id;

    // Reset device streaming state
    await db.query(`
      UPDATE devices
      SET last_stream_ping_at = NULL,
          active_channel_id = NULL,
          stream_started_at = NULL,
          current_session_id = NULL
      WHERE device_id = $1 OR id::text = $1
    `, [deviceId]);

    // Broadcast update
    if (typeof global.broadcastToClients === 'function') {
      global.broadcastToClients('live_streams_changed', {
        event: 'killed',
        session_id: id,
        device_id: deviceId
      });
    }

    success(res, { success: true, message: 'Live stream terminated successfully' });
  } catch (err) {
    console.error('killLiveStream error:', err);
    error(res, 'Failed to terminate stream', 500);
  }
};

/**
 * Fetches viewing history and aggregate watch statistics for a specific user.
 */
exports.getUserWatchHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // User cumulative stats
    const summaryRes = await db.query(`
      SELECT 
        COUNT(*) AS total_sessions,
        COALESCE(SUM(duration_seconds), 0) AS total_watch_seconds,
        COALESCE(AVG(duration_seconds), 0) AS avg_session_seconds,
        COUNT(DISTINCT channel_id) AS unique_channels_watched
      FROM stream_sessions
      WHERE user_id = $1 AND duration_seconds > 0
    `, [userId]);

    // User's top 3 channels
    const topChannelsRes = await db.query(`
      SELECT 
        c.id, c.name, c.logo_url, cat.name AS category_name,
        COUNT(*) AS session_count,
        SUM(s.duration_seconds) AS total_duration_seconds
      FROM stream_sessions s
      JOIN channels c ON s.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE s.user_id = $1 AND s.duration_seconds > 0
      GROUP BY c.id, c.name, c.logo_url, cat.name
      ORDER BY total_duration_seconds DESC
      LIMIT 3
    `, [userId]);

    // Paginated session history
    const sessionsRes = await db.query(`
      SELECT 
        s.id,
        s.channel_id,
        c.name AS channel_name,
        c.logo_url,
        cat.name AS category_name,
        s.started_at,
        s.ended_at,
        s.duration_seconds,
        s.is_active,
        s.device_model,
        s.client_platform,
        s.app_version,
        s.ip_address
      FROM stream_sessions s
      LEFT JOIN channels c ON s.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE s.user_id = $1
      ORDER BY s.started_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countRes = await db.query(
      'SELECT COUNT(*) FROM stream_sessions WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countRes.rows[0]?.count || 0, 10);
    const summary = summaryRes.rows[0] || {};
    const totalHours = (Number(summary.total_watch_seconds || 0) / 3600).toFixed(1);

    success(res, {
      summary: {
        total_sessions: parseInt(summary.total_sessions || 0),
        total_watch_hours: parseFloat(totalHours),
        total_watch_seconds: parseInt(summary.total_watch_seconds || 0),
        avg_session_minutes: Math.round(Number(summary.avg_session_seconds || 0) / 60),
        unique_channels_watched: parseInt(summary.unique_channels_watched || 0),
        top_channels: topChannelsRes.rows.map(ch => ({
          ...ch,
          total_hours: (Number(ch.total_duration_seconds || 0) / 3600).toFixed(1)
        }))
      },
      sessions: sessionsRes.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('getUserWatchHistory error:', err);
    error(res, 'Failed to fetch user watch history', 500);
  }
};

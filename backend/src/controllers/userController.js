const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch profile', 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, email, mobile } = req.body;
    const result = await db.query(
      'UPDATE users SET full_name = $1, email = $2, mobile = $3, updated_at = NOW() WHERE id = $4 RETURNING id, full_name, email, mobile, status, role',
      [full_name, email, mobile, req.user.id]
    );
    success(res, result.rows[0], 'Profile updated successfully');
  } catch (err) {
    error(res, 'Failed to update profile', 500);
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, f.created_at as favorited_at FROM favorites f
       JOIN channels c ON f.channel_id = c.id
       WHERE f.user_id = $1 AND c.status NOT IN ('hidden', 'disabled')
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch favorites', 500);
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const { channelId } = req.params;
    // Verify channel exists
    const channelResult = await db.query(
      'SELECT id FROM channels WHERE id = $1 AND status NOT IN (\'hidden\', \'disabled\')',
      [channelId]
    );
    if (channelResult.rows.length === 0) {
      return error(res, 'Channel not found', 404);
    }
    const result = await db.query(
      'INSERT INTO favorites (user_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [req.user.id, channelId]
    );
    // If a row was inserted (not a duplicate), increment favorite_count
    if (result.rows.length > 0) {
      db.query(
        `UPDATE channels SET favorite_count = COALESCE(favorite_count, 0) + 1,
           popularity_score = COALESCE(popularity_score, 0) + 5
         WHERE id = $1`,
        [channelId]
      ).catch(() => {}); // fire-and-forget, don't fail the request
    }
    success(res, null, 'Added to favorites', 201);
  } catch (err) {
    console.error('addFavorite error:', err.message);
    error(res, 'Failed to add favorite', 500);
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { channelId } = req.params;
    const result = await db.query(
      'DELETE FROM favorites WHERE user_id = $1 AND channel_id = $2 RETURNING id',
      [req.user.id, channelId]
    );
    // Decrement favorite_count only if a row was actually deleted
    if (result.rows.length > 0) {
      db.query(
        `UPDATE channels SET
           favorite_count = GREATEST(0, COALESCE(favorite_count, 0) - 1),
           popularity_score = GREATEST(0, COALESCE(popularity_score, 0) - 5)
         WHERE id = $1`,
        [channelId]
      ).catch(() => {});
    }
    success(res, null, 'Removed from favorites');
  } catch (err) {
    error(res, 'Failed to remove favorite', 500);
  }
};

exports.getWatchHistory = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT ON (c.id) c.*, wh.watched_at, wh.watch_duration
       FROM watch_history wh
       JOIN channels c ON wh.channel_id = c.id
       WHERE wh.user_id = $1 AND c.status NOT IN ('hidden', 'disabled')
       ORDER BY c.id, wh.watched_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch watch history', 500);
  }
};

exports.getDevices = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, device_id, device_name, platform, app_version, status, last_active_at, created_at FROM devices WHERE user_id = $1 ORDER BY last_active_at DESC',
      [req.user.id]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch devices', 500);
  }
};

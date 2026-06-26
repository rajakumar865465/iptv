const fs = require('fs');
const path = require('path');
const base = 'backend/src/controllers';

const dup = `const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getDuplicates = async (req, res) => {
  try {
    const result = await db.query(\`SELECT c.canonical_name, COALESCE(c.language,'Unknown') AS language, cat.name AS category, COUNT(*) AS count,
      JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name, 'status', c.status, 'health_status', c.health_status, 'quality', c.quality) ORDER BY c.id) AS channels
      FROM channels c LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status NOT IN ('merged','duplicate') AND c.canonical_name IS NOT NULL AND c.canonical_name != ''
      GROUP BY c.canonical_name, COALESCE(c.language,'Unknown'), cat.name
      HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC, c.canonical_name LIMIT 200\`);
    success(res, { total_groups: result.rows.length, groups: result.rows });
  } catch (err) {
    error(res, 'Failed to fetch duplicates', 500);
  }
};

exports.mergeDuplicates = async (req, res) => {
  try {
    const { masterId, duplicateIds } = req.body;
    for (const dupId of duplicateIds) {
      await db.query('UPDATE channel_streams SET channel_id = $1 WHERE channel_id = $2', [masterId, dupId]);
      await db.query("UPDATE channels SET status = 'merged', updated_at = NOW() WHERE id = $1", [dupId]);
    }
    success(res, null, 'Duplicates merged');
  } catch (err) {
    error(res, 'Failed to merge duplicates', 500);
  }
};`;

const lang = `const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getLanguages = async (req, res) => {
  try {
    const result = await db.query(\`SELECT INITCAP(LOWER(TRIM(language))) as name, COUNT(*) as channel_count FROM channels WHERE language IS NOT NULL AND language != '' GROUP BY LOWER(TRIM(language)) ORDER BY COUNT(*) DESC\`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch languages', 500);
  }
};`;

const notif = `const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getNotifications = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch notifications', 500);
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { title, body, target_type, target_ids, image_url, action_url, scheduled_at } = req.body;
    const result = await db.query('INSERT INTO notifications (title, body, target_type, target_ids, image_url, action_url, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, body, target_type, target_ids || [], image_url || null, action_url || null, scheduled_at || null]);
    success(res, result.rows[0], 'Notification created', 201);
  } catch (err) {
    error(res, 'Failed to create notification', 500);
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, target_type, is_active, scheduled_at } = req.body;
    const result = await db.query('UPDATE notifications SET title = $1, body = $2, target_type = $3, is_active = $4, scheduled_at = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [title, body, target_type, is_active, scheduled_at, id]);
    success(res, result.rows[0], 'Notification updated');
  } catch (err) {
    error(res, 'Failed to update notification', 500);
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM notifications WHERE id = $1', [id]);
    success(res, null, 'Notification deleted');
  } catch (err) {
    error(res, 'Failed to delete notification', 500);
  }
};`;

const anly = `const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getUserAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(\`SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE role = 'user' AND created_at > NOW() - INTERVAL '\${days} days' GROUP BY DATE(created_at) ORDER BY date\`);
    const activeUsers = await db.query(\`SELECT DATE(last_login_at) as date, COUNT(*) as count FROM users WHERE last_login_at > NOW() - INTERVAL '\${days} days' GROUP BY DATE(last_login_at) ORDER BY date\`);
    success(res, { signups: result.rows, active: activeUsers.rows });
  } catch (err) {
    error(res, 'Failed to fetch analytics', 500);
  }
};

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(\`SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' AND created_at > NOW() - INTERVAL '\${days} days' GROUP BY DATE(created_at) ORDER BY date\`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch revenue analytics', 500);
  }
};

exports.getPlaybackAnalytics = async (req, res) => {
  try {
    const result = await db.query(\`SELECT c.name, COUNT(*) as play_count FROM watch_history w JOIN channels c ON w.channel_id = c.id WHERE w.watched_at > NOW() - INTERVAL '30 days' GROUP BY c.id, c.name ORDER BY play_count DESC LIMIT 20\`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch playbackмет playback analytics', 500);
  }
};`;

const logs = `const db = require('../config/db');
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
    error(res, 'Failed to fetch API errors', 宁愿);
  }
};

exports.getAdminActions = async (req, res) => {
  try {
    const { page = 1, limit = 50, admin_id } = req.query;
    const offset = (page - 1) * limit;
    let params = [];
    let whereStr = '';
    if (admin_id) {
      whereStr = 'WHERE admin_id = $1';
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
};`;

const sys = `const db = require('../config/db');
const os = require('os');
const { success, error } = require('

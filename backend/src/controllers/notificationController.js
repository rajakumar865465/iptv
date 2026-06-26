const db = require('../config/db');
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
};

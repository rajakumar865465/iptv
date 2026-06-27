const db = require('../config/db');
const { success, error } = require('../utils/response');

// FCM integration for push notifications (add to package.json: npm install firebase-admin)
let fcmAdmin = null;
try {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    // Initialize with service account from env vars
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  fcmAdmin = admin;
} catch (e) {
  console.log('[Notification] Firebase Admin not configured - push notifications disabled');
}

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
    const result = await db.query(
      'INSERT INTO notifications (title, body, target_type, target_ids, image_url, action_url, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, body, target_type, target_ids || [], image_url || null, action_url || null, scheduled_at || null]
    );
    
    // If scheduled for now or in the past, send immediately
    if (!scheduled_at || new Date(scheduled_at) <= new Date()) {
      await sendNotification(result.rows[0]);
    }
    
    success(res, result.rows[0], 'Notification created', 201);
  } catch (err) {
    error(res, 'Failed to create notification', 500);
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, target_type, is_active, scheduled_at } = req.body;
    const result = await db.query(
      'UPDATE notifications SET title = $1, body = $2, target_type = $3, is_active = $4, scheduled_at = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [title, body, target_type, is_active, scheduled_at, id]
    );
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

// Send push notification to devices
async function sendNotification(notification) {
  if (!fcmAdmin) {
    console.log('[Notification] FCM not configured - notification not sent:', notification.title);
    return;
  }
  
  try {
    let message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image_url
      },
      data: {
        action_url: notification.action_url || '',
        notification_id: notification.id.toString()
      }
    };

    // Target specific users or all users
    if (notification.target_type === 'all') {
      message.topic = 'all_users';
    } else if (notification.target_type === 'user' && notification.target_ids?.length > 0) {
      // Send to specific user IDs - would need FCM tokens stored per user
      // For now, log that we'd need to implement token storage
      console.log('[Notification] Would send to users:', notification.target_ids);
      return;
    } else if (notification.target_type === 'user') {
      message.topic = 'all_users';
    }

    await fcmAdmin.messaging().send(message);
    console.log('[Notification] Sent:', notification.title);
  } catch (err) {
    console.error('[Notification] Send failed:', err.message);
  }
}

// Scheduled job to send pending notifications
exports.processScheduledNotifications = async () => {
  try {
    const now = new Date().toISOString();
    const result = await db.query(
      `SELECT * FROM notifications 
       WHERE is_active = true 
         AND (scheduled_at IS NULL OR scheduled_at <= $1)
         AND sent_at IS NULL`,
      [now]
    );
    
    for (const notification of result.rows) {
      await sendNotification(notification);
      await db.query('UPDATE notifications SET sent_at = NOW() WHERE id = $1', [notification.id]);
    }
    
    return result.rows.length;
  } catch (err) {
    console.error('[Notification] Scheduled job failed:', err.message);
    return 0;
  }
};

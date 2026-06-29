const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const maintenanceController = require('../controllers/maintenanceController');
const deviceController = require('../controllers/deviceController');
const planController = require('../controllers/planController');
const analyticsController = require('../controllers/analyticsController');
const systemController = require('../controllers/systemController');
const logController = require('../controllers/logController');
const scannerController = require('../controllers/scannerController');
const brokenChannelController = require('../controllers/brokenChannelController');
const channelStreamController = require('../controllers/channelStreamController');
const duplicateController = require('../controllers/duplicateController');
const languageController = require('../controllers/languageController');
const notificationController = require('../controllers/notificationController');
const adminUserController = require('../controllers/adminUserController');
const publicController = require('../controllers/publicController');
const adminAuthMiddleware = require('../middleware/adminAuth');
const { authLimiter } = require('../middleware/rateLimit');
const db = require('../config/db');

// Public admin login
router.post('/login', authLimiter, adminController.adminLogin);

// Admin profile
router.get('/me', adminAuthMiddleware, (req, res) => {
  const { password_hash, ...admin } = req.user;
  res.json({ success: true, data: admin });
});

// Protected admin routes
router.use(adminAuthMiddleware);

// ─── Dashboard ──────────────────────────────────────
const dashboardController = require('../controllers/dashboardController');
router.get('/dashboard/stats', dashboardController.getDashboardStats);

// ─── Maintenance jobs (also require MAINTENANCE_SECRET header) ──
router.get('/maintenance/status', maintenanceController.getStatus);
router.post('/maintenance/run-migrations', maintenanceController.runMigrations);
router.post('/maintenance/dedupe-channels', maintenanceController.dedupeChannels);
router.post('/maintenance/activate-channels', maintenanceController.activateChannels);
router.post('/maintenance/generate-report', maintenanceController.generateReport);
router.post('/maintenance/run-all', maintenanceController.runAll);

// ─── Users ────────────────────────────────────────
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/status', adminController.updateUserStatus);

// ─── Devices ──────────────────────────────────────
router.get('/devices', deviceController.getAllDevices);
router.delete('/devices/:id', deviceController.deleteDevice);
router.put('/devices/:id/status', deviceController.updateDeviceStatus);

// ─── Licenses ─────────────────────────────────────
router.post('/licenses', adminController.createLicense);
router.get('/licenses', adminController.getLicenses);
router.put('/licenses/:id', adminController.updateLicense);
router.post('/licenses/:id/extend', adminController.extendLicense);
router.post('/licenses/:id/suspend', adminController.suspendLicense);
router.post('/licenses/:id/revoke', adminController.revokeLicense);

// ─── Plans ────────────────────────────────────────
router.get('/plans', planController.getPlans);
router.post('/plans', planController.createPlan);
router.put('/plans/:id', planController.updatePlan);
router.delete('/plans/:id', planController.deletePlan);

// ─── Payments ─────────────────────────────────────
router.get('/payments', adminController.getPayments);
router.put('/payments/:id/status', adminController.updatePaymentStatus);

// ─── Channels ─────────────────────────────────────
router.post('/channels', adminController.createChannel);
router.get('/channels', adminController.getChannelsAdmin);
router.put('/channels/:id', adminController.updateChannel);
router.delete('/channels/:id', adminController.deleteChannel);

// ─── Channel Streams ──────────────────────────────
router.get('/channel-streams/:id', channelStreamController.getChannelStreams);
router.post('/channel-streams', channelStreamController.createChannelStream);
router.put('/channel-streams/:id', channelStreamController.updateChannelStream);
router.delete('/channel-streams/:id', channelStreamController.deleteChannelStream);
router.put('/channel-streams/:id/primary', channelStreamController.setPrimaryStream);
router.post('/channel-streams/:id/diagnose', channelStreamController.diagnoseChannelStream);

// ─── Broken Channels ──────────────────────────────
router.get('/channels/broken', brokenChannelController.getBrokenChannels);
router.post('/channels/broken/:id/fix', brokenChannelController.fixChannel);

// ─── Duplicate Channels ───────────────────────────
router.get('/channels/duplicates', duplicateController.getDuplicates);
router.post('/channels/duplicates/merge', duplicateController.mergeDuplicates);

// ─── Categories ───────────────────────────────────────
router.post('/categories', adminController.createCategory);
router.get('/categories', adminController.getCategoriesAdmin);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// ─── Languages ────────────────────────────────────
router.get('/languages', languageController.getLanguages);

// ─── App Settings ─────────────────────────────────
router.get('/app-settings', adminController.getAppSettings);
router.put('/app-settings', adminController.updateAppSettings);

// ─── Notifications ──────────────────────────────────
router.get('/notifications', notificationController.getNotifications);
router.post('/notifications', notificationController.createNotification);
router.put('/notifications/:id', notificationController.updateNotification);
router.delete('/notifications/:id', notificationController.deleteNotification);

// ─── Analytics ────────────────────────────────────
router.get('/analytics/users', analyticsController.getUserAnalytics);
router.get('/analytics/revenue', analyticsController.getRevenueAnalytics);
router.get('/analytics/playback', analyticsController.getPlaybackAnalytics);

// ─── Stream Scanner ───────────────────────────────
router.post('/scanner/trigger', scannerController.triggerScan);
router.get('/scanner/:id', scannerController.getScanStatus);
router.get('/scanner', scannerController.getScanHistory);

// ─── System Health ────────────────────────────────
router.get('/system/health', systemController.getSystemHealth);

// ─── Logs ─────────────────────────────────────────
router.get('/logs/api-errors', logController.getApiErrors);
router.get('/logs/admin-actions', logController.getAdminActions);

// ─── Admin Users ──────────────────────────────────
router.get('/admin-users', adminUserController.getAdminUsers);
router.post('/admin-users', adminUserController.createAdminUser);
router.put('/admin-users/:id', adminUserController.updateAdminUser);

// ─── Popularity & UI Controls ─────────────────────
// POST /api/internal/channels/recalculate-popularity
router.post('/channels/recalculate-popularity', async (req, res) => {
  try {
    // Update watch_count, favorite_count from actual data
    await db.query(`
      UPDATE channels c
      SET watch_count = COALESCE((
        SELECT COUNT(*) FROM watch_history wh WHERE wh.channel_id = c.id
      ), 0),
      favorite_count = COALESCE((
        SELECT COUNT(*) FROM favorites f WHERE f.channel_id = c.id
      ), 0)
    `);

    // Recalculate popularity_score
    await db.query(`
      UPDATE channels
      SET popularity_score = (
        (COALESCE(watch_count, 0) * 3)
        + (COALESCE(favorite_count, 0) * 5)
        + CASE WHEN is_featured = true THEN 50 ELSE 0 END
        + CASE WHEN EXISTS (
            SELECT 1 FROM watch_history wh
            WHERE wh.channel_id = channels.id
              AND wh.watched_at > NOW() - INTERVAL '7 days'
          ) THEN 30 ELSE 0 END
      )
    `);

    // Mark is_popular
    const updated = await db.query(`
      UPDATE channels SET is_popular = true
      WHERE popularity_score > 0 OR is_featured = true
      RETURNING id
    `);

    return res.json({
      success: true,
      message: `Popularity recalculated. ${updated.rowCount} channels marked popular.`,
    });
  } catch (err) {
    console.error('[admin] recalculate-popularity error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/internal/channels/:id — update UI control fields
// Allows: is_featured, is_premium, is_popular, sort_order, show_on_home, home_section_enabled, status
router.put('/channels/:id/ui', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      is_featured, is_premium, is_popular,
      sort_order, category_sort_order,
      show_on_home, home_section_enabled, status,
    } = req.body;

    const setClauses = [];
    const params = [];
    let pi = 1;

    if (is_featured !== undefined) { setClauses.push(`is_featured = $${pi++}`); params.push(is_featured); }
    if (is_premium !== undefined)  { setClauses.push(`is_premium = $${pi++}`); params.push(is_premium); }
    if (is_popular !== undefined)  { setClauses.push(`is_popular = $${pi++}`); params.push(is_popular); }
    if (sort_order !== undefined)  { setClauses.push(`sort_order = $${pi++}`); params.push(sort_order); }
    if (category_sort_order !== undefined) { setClauses.push(`category_sort_order = $${pi++}`); params.push(category_sort_order); }
    if (show_on_home !== undefined) { setClauses.push(`show_on_home = $${pi++}`); params.push(show_on_home); }
    if (home_section_enabled !== undefined) { setClauses.push(`home_section_enabled = $${pi++}`); params.push(home_section_enabled); }
    if (status !== undefined)      { setClauses.push(`status = $${pi++}`); params.push(status); }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE channels SET ${setClauses.join(', ')} WHERE id = $${pi} RETURNING id, name, is_featured, is_premium, is_popular, sort_order, show_on_home, status`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[admin] channel ui update error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// App releases
router.get('/app-releases', adminAuthMiddleware, publicController.getAppReleases);
router.post('/app-releases', adminAuthMiddleware, publicController.createAppRelease);
router.put('/app-releases/:id', adminAuthMiddleware, publicController.updateAppRelease);

// Website settings
router.get('/website-settings', adminAuthMiddleware, publicController.getWebsiteSettings);
router.put('/website-settings', adminAuthMiddleware, publicController.updateWebsiteSettings);

module.exports = router;

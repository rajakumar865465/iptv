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
const adminChannelManagementController = require('../controllers/adminChannelManagementController');
const channelImportController = require('../controllers/channelImportController');
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

// ─── User Feedback ────────────────────────────────
const userFeedbackController = require('../controllers/userFeedbackController');
router.get('/feedback', userFeedbackController.getFeedback);
router.patch('/feedback/:id', userFeedbackController.updateFeedback);

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

// ─── Channel Management (Hide/Remove/Restore) ─────────
router.post('/channels/:id/hide', adminChannelManagementController.hideChannel);
router.post('/channels/:id/remove', adminChannelManagementController.removeChannel);
router.post('/channels/:id/restore', adminChannelManagementController.restoreChannel);
router.post('/channels/restore-all-hidden', adminChannelManagementController.restoreAllHiddenChannels);
router.get('/channels-hidden', adminChannelManagementController.getHiddenChannels);
router.get('/channels-removed', adminChannelManagementController.getRemovedChannels);

// ─── Channel Import ───────────────────────────────────
router.post('/import/iptv-org', adminChannelManagementController.startImportJob);
router.get('/import/jobs', adminChannelManagementController.getImportJobs);

// ─── M3U Channel Importer & Stream Health Scanner ───────
// Staged import: parse M3U -> scan (health + duplicate detection) -> admin
// reviews/selects -> import. Nothing hits `channels` until the final step.
router.post('/channel-import/fetch', channelImportController.fetchM3u);
router.post('/channel-import/parse', channelImportController.parseAndCreateSession);
router.post('/channel-import/:id/scan', channelImportController.startScan);
router.get('/channel-import/:id/items', channelImportController.getSessionItems);
router.get('/channel-import/:id', channelImportController.getSession);
router.post('/channel-import/:id/import', channelImportController.importSelected);
router.post('/channel-import/:id/cancel', channelImportController.cancelSession);
router.get('/channel-import', channelImportController.listSessions);

// ─── Channel Streams ──────────────────────────────
router.get('/channel-streams/:id', channelStreamController.getChannelStreams);
router.post('/channel-streams', channelStreamController.createChannelStream);
router.put('/channel-streams/:id', channelStreamController.updateChannelStream);
router.delete('/channel-streams/:id', channelStreamController.deleteChannelStream);
router.put('/channel-streams/:id/primary', channelStreamController.setPrimaryStream);
router.post('/channel-streams/:id/diagnose', channelStreamController.diagnoseChannelStream);

// ─── Broken Channels ──────────────────────────────
router.get('/channels/broken', brokenChannelController.getBrokenChannels);
router.post('/channels/broken/bulk-action', brokenChannelController.bulkAction);
router.post('/channels/broken/:id/fix', brokenChannelController.fixChannel);
router.post('/channels/broken/:id/verify', brokenChannelController.verifyChannel);

// ─── Duplicate Channels ───────────────────────────
router.get('/channels/duplicates', duplicateController.getDuplicates);
router.post('/channels/duplicates/merge', duplicateController.mergeDuplicates);

// ─── Reported Channels ────────────────────────────
router.get('/channels/reports', adminChannelManagementController.getReportedChannels);
router.put('/channels/reports/:id/status', adminChannelManagementController.updateReportStatus);

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
router.get('/logs/system', logController.getSystemLogs);

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
router.post('/app-releases/upload', adminAuthMiddleware, publicController.apkUploadMiddleware, publicController.uploadApkFile);
router.put('/app-releases/:id', adminAuthMiddleware, publicController.updateAppRelease);
router.delete('/app-releases/:id', adminAuthMiddleware, publicController.deleteAppRelease);



// Website settings
router.get('/website-settings', adminAuthMiddleware, publicController.getWebsiteSettings);
router.put('/website-settings', adminAuthMiddleware, publicController.updateWebsiteSettings);

// ─── Stream Health Dashboard ───────────────────────────────────────────────
// All routes require admin auth (applied globally above via router.use)
const streamHealthController = require('../controllers/streamHealthController');

// ─── Smooth Playback / Delayed Live Buffer ────────────────────────────────────
const smoothPlaybackController = require('../controllers/smoothPlaybackController');
router.get('/smooth-playback/health', smoothPlaybackController.adminBufferHealth);
router.get('/smooth-playback/channels', smoothPlaybackController.adminListChannels);
router.post('/smooth-playback/channels/disable-all', smoothPlaybackController.adminDisableAllChannels);
router.put('/smooth-playback/channels/:id', smoothPlaybackController.adminUpdateChannel);
router.post('/smooth-playback/channels/:id/restart', smoothPlaybackController.adminRestartRecorder);
router.get('/smooth-playback/channels/:channelId/fallback-logs', smoothPlaybackController.adminGetFallbackLogs);
router.post('/smooth-playback/channels/:id/clear-stale', smoothPlaybackController.adminClearStaleBuffer);
router.post('/smooth-playback/channels/:id/test-segment', smoothPlaybackController.adminTestSegmentDownload);
router.post('/smooth-playback/channels/:id/promote-backup', smoothPlaybackController.adminPromoteBackup);
router.post('/smooth-playback/channels/:id/reset-counters', smoothPlaybackController.adminResetBufferCounters);

// GET  /api/admin/stream-health
//   ?status=unstable|likely_broken|offline|requires_licensed_source|...
//   ?needs_check=true  (channels with needs_manual_verification=true)
//   ?search=channelName
//   ?page=1&limit=50
router.get('/stream-health', streamHealthController.getStreamHealth);

// POST /api/admin/stream-health/:channelId/mark
//   Body: { action, note }
//   Actions: mark_working | mark_unstable | requires_licensed_source |
//            hide_app | hide_website | hide_everywhere | restore |
//            clear_verification | set_note
router.post('/stream-health/:channelId/mark', streamHealthController.markStreamStatus);

// POST /api/admin/stream-health/:channelId/recheck
//   Runs deep stream diagnosis and updates health fields
router.post('/stream-health/:channelId/recheck', streamHealthController.recheckStream);

module.exports = router;

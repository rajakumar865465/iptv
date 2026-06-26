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

// ─── Broken Channels ──────────────────────────────
router.get('/channels/broken', brokenChannelController.getBrokenChannels);
router.post('/channels/broken/:id/fix', brokenChannelController.fixChannel);

// ─── Duplicate Channels ───────────────────────────
router.get('/channels/duplicates', duplicateController.getDuplicates);
router.post('/channels/duplicates/merge', duplicateController.mergeDuplicates);

// ─── Categories ───────────────────────────────────
router.post('/categories', adminController.createCategory);
router.get('/categories', adminController.getCategoriesAdmin);
router.put('/categories/:id', adminController.updateCategory);

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
router.get('/_logs/admin-actions', logController.getAdminActions);

// ─── Admin Users ──────────────────────────────────
router.get('/admin-users', adminUserController.getAdminUsers);
router.post('/admin-users', adminUserController.createAdminUser);
router.put('/admin-users/:id', adminUserController.updateAdminUser);

module.exports = router;

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
// Fix #16: Use dedicated adminAuth middleware (verifies ADMIN_JWT_SECRET tokens)
// instead of the user authMiddleware (which verifies JWT_SECRET tokens).
// Admin tokens are generated with generateAdminToken() using ADMIN_JWT_SECRET,
// so they would fail the regular authMiddleware.
const adminAuthMiddleware = require('../middleware/adminAuth');
const { authLimiter } = require('../middleware/rateLimit');

// Public admin login
router.post('/login', authLimiter, adminController.adminLogin);

// Protected admin routes — use dedicated admin auth (no separate adminMiddleware needed,
// adminAuthMiddleware already checks role = 'admin')
router.use(adminAuthMiddleware);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/status', adminController.updateUserStatus);

// Licenses
router.post('/licenses', adminController.createLicense);
router.get('/licenses', adminController.getLicenses);
router.put('/licenses/:id', adminController.updateLicense);
router.post('/licenses/:id/extend', adminController.extendLicense);
router.post('/licenses/:id/suspend', adminController.suspendLicense);
router.post('/licenses/:id/revoke', adminController.revokeLicense);

// Channels
router.post('/channels', adminController.createChannel);
router.get('/channels', adminController.getChannelsAdmin);
router.put('/channels/:id', adminController.updateChannel);
router.delete('/channels/:id', adminController.deleteChannel);
// Duplicate detection report
router.get('/channels/duplicates', adminController.getChannelDuplicates);

// Categories
router.post('/categories', adminController.createCategory);
router.get('/categories', adminController.getCategoriesAdmin);
router.put('/categories/:id', adminController.updateCategory);

// App Settings
router.get('/app-settings', adminController.getAppSettings);
router.put('/app-settings', adminController.updateAppSettings);

// Payments
router.get('/payments', adminController.getPayments);
router.put('/payments/:id/status', adminController.updatePaymentStatus);

module.exports = router;

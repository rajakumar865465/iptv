const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { authLimiter } = require('../middleware/rateLimit');

// Public admin login
router.post('/login', authLimiter, adminController.adminLogin);

// Protected admin routes
router.use(authMiddleware, adminMiddleware);

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

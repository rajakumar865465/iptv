const express = require('express');
const router = express.Router();
const { authLimiter, apiLimiter } = require('../middleware/rateLimit');
const pub = require('../controllers/publicController');

// Read-only public data
router.get('/plans', apiLimiter, pub.getPlans);
router.get('/channels/popular', apiLimiter, pub.getPopularChannels);
router.get('/channels/preview', apiLimiter, pub.getChannelPreview);
router.get('/categories', apiLimiter, pub.getCategories);
router.get('/app/download', apiLimiter, pub.getAppDownload);
router.get('/settings', apiLimiter, pub.getSettings);

// Payment flow — strict rate limiting
router.post('/orders/create', authLimiter, pub.createOrder);
router.post('/payments/verify', authLimiter, pub.verifyPayment);
router.get('/payments/status/:orderId', apiLimiter, pub.getOrderStatus);

// License check — use stricter auth limiter to prevent key enumeration
router.post('/license/check', authLimiter, pub.checkLicense);

// Scratch card offer — returns hidden 7-day plan metadata only
router.get('/offers/7day', apiLimiter, pub.getSevenDayOffer);

module.exports = router;

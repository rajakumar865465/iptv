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

// License check
router.post('/license/check', apiLimiter, pub.checkLicense);

// Scratch card offer — returns hidden 7-day plan metadata only
router.get('/offers/7day', apiLimiter, pub.getSevenDayOffer);

// PUBLIC DEBUG: Raw license list for troubleshooting (no auth required)
router.get('/debug/licenses', async (req, res) => {
  const db = require('../config/db');
  const li = await db.query("SELECT id, license_key, status, user_id, plan_id, payment_id, created_at FROM licenses ORDER BY created_at DESC");
  res.json({ count: li.rows.length, rows: li.rows });
});

module.exports = router;

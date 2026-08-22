const express = require('express');
const router = express.Router();
const { authLimiter, apiLimiter, manualOrderLimiter, orderLookupLimiter } = require('../middleware/rateLimit');
const pub = require('../controllers/publicController');
const manualOrderController = require('../controllers/manualOrderController');

// Read-only public data
router.get('/plans', apiLimiter, pub.getPlans);
router.get('/channels/popular', apiLimiter, pub.getPopularChannels);
router.get('/channels/preview', apiLimiter, pub.getChannelPreview);
router.get('/categories', apiLimiter, pub.getCategories);
router.get('/app/download', apiLimiter, pub.getAppDownload);
router.get('/settings', apiLimiter, pub.getSettings);

// Razorpay gateway flow — strict rate limiting.
// Kept intact; only reachable while the admin has Razorpay as the payment mode.
router.post('/orders/create', authLimiter, pub.createOrder);
router.post('/payments/verify', authLimiter, pub.verifyPayment);
router.get('/payments/status/:orderId', apiLimiter, pub.getOrderStatus);

// Manual UPI flow — which checkout is live, server-built QR, UTR submission, status
router.get('/payment-config', apiLimiter, manualOrderController.getPaymentConfig);
router.get('/checkout/:planId', apiLimiter, manualOrderController.getCheckout);
router.post('/manual-orders', manualOrderLimiter, manualOrderController.createManualOrder);
router.get('/manual-orders/:orderId', orderLookupLimiter, manualOrderController.getManualOrder);

// License check — use stricter auth limiter to prevent key enumeration
router.post('/license/check', authLimiter, pub.checkLicense);

// Scratch card offer — returns hidden 7-day plan metadata only
router.get('/offers/7day', apiLimiter, pub.getSevenDayOffer);

module.exports = router;

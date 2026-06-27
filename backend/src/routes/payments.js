const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');

router.get('/plans', paymentController.getPlans);
router.get('/status', authMiddleware, paymentController.getStatus);
router.post('/razorpay/create-order', authMiddleware, paymentController.createRazorpayOrder);
router.post('/razorpay/verify', authMiddleware, paymentController.verifyRazorpayPayment);
router.post('/manual-request', authMiddleware, paymentController.manualRequest);
router.get('/history', authMiddleware, paymentController.getHistory);

module.exports = router;

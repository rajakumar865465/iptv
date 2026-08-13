const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController');
const otpAuthController = require('../controllers/otpAuthController');
const { standardLimiter, authLimiter, refreshLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/auth');

router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/google-login', authLimiter, googleAuthController.googleLogin);
router.post('/send-otp', authLimiter, otpAuthController.sendOtp);
router.post('/verify-otp', authLimiter, otpAuthController.verifyOtp);
router.post('/logout', standardLimiter, authController.logout);
router.post('/refresh-token', refreshLimiter, authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/me', authMiddleware, authController.me);
router.get('/my-purchases', authMiddleware, authController.myPurchases);

module.exports = router;

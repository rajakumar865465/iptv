const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { standardLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/auth');

router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/logout', standardLimiter, authController.logout);
router.post('/refresh-token', authLimiter, authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/me', authMiddleware, authController.me);

module.exports = router;

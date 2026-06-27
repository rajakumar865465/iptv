const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { standardLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/auth');

router.post('/signup', standardLimiter, authController.signup);
router.post('/login', standardLimiter, authController.login);
router.post('/logout', standardLimiter, authController.logout);
router.post('/refresh-token', standardLimiter, authController.refreshToken);
router.post('/forgot-password', standardLimiter, authController.forgotPassword);
router.post('/reset-password', standardLimiter, authController.resetPassword);
router.get('/me', authMiddleware, authController.me);

module.exports = router;

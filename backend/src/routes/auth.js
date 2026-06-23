const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { standardLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/auth');

router.post('/signup', standardLimiter, authController.signup);
router.post('/login', standardLimiter, authController.login);
router.post('/logout', standardLimiter, authController.logout);
router.post('/forgot-password', standardLimiter, authController.forgotPassword);
router.get('/me', authMiddleware, authController.me);

module.exports = router;

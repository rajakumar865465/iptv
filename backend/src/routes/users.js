const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userFeedbackController = require('../controllers/userFeedbackController');
const authMiddleware = require('../middleware/auth');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.get('/favorites', authMiddleware, userController.getFavorites);
router.post('/favorites/:channelId', authMiddleware, userController.addFavorite);
router.delete('/favorites/:channelId', authMiddleware, userController.removeFavorite);
router.get('/watch-history', authMiddleware, userController.getWatchHistory);
router.get('/devices', authMiddleware, userController.getDevices);
router.post('/feedback', authMiddleware, userFeedbackController.submitFeedback);

module.exports = router;

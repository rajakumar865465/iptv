const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { apiLimiter } = require('../middleware/rateLimit');

// GET /api/categories
router.get('/', apiLimiter, channelController.getCategories);

module.exports = router;

const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');
const { apiLimiter } = require('../middleware/rateLimit');

// /api/stream/transcode/:channelId?quality=360&token=...
router.get('/transcode/:channelId', apiLimiter, streamController.transcodeStream);

module.exports = router;

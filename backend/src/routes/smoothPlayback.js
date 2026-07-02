const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/smoothPlaybackController');
const { apiLimiter } = require('../middleware/rateLimit');

// Serve delayed HLS playlists and segments (no auth — accessed by media player)
router.get('/:channelId/playlist.m3u8', ctrl.servePlaylist);
router.get('/:channelId/media.m3u8', ctrl.serveMediaPlaylist);
router.get('/:channelId/segments/:segmentName', ctrl.serveSegment);

module.exports = router;

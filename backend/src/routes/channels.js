const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { apiLimiter, searchLimiter, channelReportLimiter } = require('../middleware/rateLimit');

const { optionalAuth } = require('../middleware/auth');

router.get('/', apiLimiter, optionalAuth, channelController.getChannels);
router.get('/list', apiLimiter, optionalAuth, channelController.getChannels);
router.get('/search', searchLimiter, optionalAuth, channelController.searchChannels);
router.get('/categories', apiLimiter, channelController.getCategories);
router.get('/languages', apiLimiter, channelController.getLanguages);
router.get('/category/:categoryId', apiLimiter, optionalAuth, channelController.getChannelsByCategory);
router.get('/:id', apiLimiter, optionalAuth, channelController.getChannel);
router.get('/:id/epg/now', apiLimiter, channelController.getChannelEPGNow);
router.get('/:id/epg/upcoming', apiLimiter, channelController.getChannelEPGUpcoming);
router.get('/:id/playback', apiLimiter, optionalAuth, channelController.getChannelPlayback);
router.get('/:id/smooth-playback', apiLimiter, optionalAuth, require('../controllers/smoothPlaybackController').getSmoothPlayback);
router.get('/:id/related', apiLimiter, channelController.getRelatedChannels);
// Failure reporting influences channel health_status and has a tight per-IP+per-channel limiter.
// Playback results and display telemetry use standard API limiter.
router.post('/:id/report-failure', apiLimiter, channelReportLimiter, optionalAuth, channelController.reportFailure);
router.post('/:id/playback-result', apiLimiter, optionalAuth, channelController.reportPlaybackResult);
router.post('/:id/display-report', apiLimiter, optionalAuth, channelController.reportChannelDisplay);

module.exports = router;

const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { apiLimiter, searchLimiter, channelReportLimiter } = require('../middleware/rateLimit');

const { optionalAuth } = require('../middleware/auth');

router.get('/', apiLimiter, channelController.getChannels);
router.get('/search', searchLimiter, channelController.searchChannels);
router.get('/categories', apiLimiter, channelController.getCategories);
router.get('/languages', apiLimiter, channelController.getLanguages);
router.get('/category/:categoryId', apiLimiter, channelController.getChannelsByCategory);
router.get('/:id', apiLimiter, channelController.getChannel);
router.get('/:id/epg/now', apiLimiter, channelController.getChannelEPGNow);
router.get('/:id/epg/upcoming', apiLimiter, channelController.getChannelEPGUpcoming);
router.get('/:id/playback', apiLimiter, optionalAuth, channelController.getChannelPlayback);
router.get('/:id/smooth-playback', apiLimiter, optionalAuth, require('../controllers/smoothPlaybackController').getSmoothPlayback);
router.get('/:id/related', apiLimiter, channelController.getRelatedChannels);
// These telemetry endpoints influence a channel's health_status, so they get
// optionalAuth (identifies logged-in users) plus a tight per-IP+per-channel
// rate limit to stop a single anonymous actor from brute-forcing the
// fail-count thresholds (mobile app also reports for users not logged in yet).
router.post('/:id/report-failure', apiLimiter, channelReportLimiter, optionalAuth, channelController.reportFailure);
router.post('/:id/playback-result', apiLimiter, channelReportLimiter, optionalAuth, channelController.reportPlaybackResult);
router.post('/:id/display-report', apiLimiter, channelReportLimiter, optionalAuth, channelController.reportChannelDisplay);

module.exports = router;

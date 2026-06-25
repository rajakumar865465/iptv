const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { apiLimiter, searchLimiter } = require('../middleware/rateLimit');

router.get('/', apiLimiter, channelController.getChannels);
router.get('/search', searchLimiter, channelController.searchChannels);
router.get('/categories', apiLimiter, channelController.getCategories);
router.get('/category/:categoryId', apiLimiter, channelController.getChannelsByCategory);
router.get('/:id', apiLimiter, channelController.getChannel);
router.get('/:id/epg/now', apiLimiter, channelController.getChannelEPGNow);
router.get('/:id/epg/upcoming', apiLimiter, channelController.getChannelEPGUpcoming);
router.get('/:id/playback', apiLimiter, channelController.getChannelPlayback);
router.get('/:id/related', apiLimiter, channelController.getRelatedChannels);
router.post('/:id/report-failure', apiLimiter, channelController.reportFailure);

module.exports = router;

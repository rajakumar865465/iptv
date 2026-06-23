const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { standardLimiter } = require('../middleware/rateLimit');

router.get('/', standardLimiter, channelController.getChannels);
router.get('/search', standardLimiter, channelController.searchChannels);
router.get('/categories', standardLimiter, channelController.getCategories);
router.get('/category/:categoryId', standardLimiter, channelController.getChannelsByCategory);
router.get('/:id', standardLimiter, channelController.getChannel);

module.exports = router;

const express = require('express');
const router = express.Router();
const appConfigController = require('../controllers/appConfigController');
const { standardLimiter } = require('../middleware/rateLimit');

router.get('/config', standardLimiter, appConfigController.getConfig);
router.get('/status', standardLimiter, appConfigController.getStatus);
router.get('/version-check', standardLimiter, appConfigController.versionCheck);

module.exports = router;

const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { apiLimiter } = require('../middleware/rateLimit');
const { optionalAuth } = require('../middleware/auth');

// GET /api/home — returns DTH-style structured home data
// optionalAuth so continue_watching works when logged in but API is accessible without auth
router.get('/', apiLimiter, optionalAuth, homeController.getHome);

module.exports = router;

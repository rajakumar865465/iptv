const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const authMiddleware = require('../middleware/auth');

router.post('/activate', authMiddleware, licenseController.activate);
router.get('/status', authMiddleware, licenseController.status);
router.post('/validate', authMiddleware, licenseController.validate);
router.get('/history', authMiddleware, licenseController.history);

module.exports = router;

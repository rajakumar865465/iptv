const express = require('express');
const router = express.Router();
const proxyController = require('../controllers/proxyController');

router.get('/:streamId/master.m3u8', proxyController.proxyManifest);
router.get('/segment/:streamId/:b64url', proxyController.proxySegment);

module.exports = router;

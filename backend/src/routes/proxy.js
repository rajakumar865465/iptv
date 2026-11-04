const express = require("express");
const router = express.Router();
const proxyPaymentController = require("../controllers/proxyPaymentController");
const proxyController = require("../controllers/proxyController");
const { optionalAuth } = require("../middleware/auth");

router.get("/checkout", proxyPaymentController.serveCheckoutPage);

// Video proxy routes
router.get("/segment/:streamId/:segToken", proxyController.proxySegment);
router.get("/:streamId/master.m3u8", optionalAuth, proxyController.proxyManifest);
router.get("/:streamId/index.m3u8", optionalAuth, proxyController.proxyManifest);
router.get("/:streamId/:segToken", optionalAuth, (req, res, next) => {
  if (req.params.segToken.endsWith(".m3u8")) {
    return proxyController.proxyManifest(req, res, next);
  }
  return proxyController.proxySegment(req, res, next);
});
router.get("/:streamId", optionalAuth, proxyController.proxyManifest);

module.exports = router;

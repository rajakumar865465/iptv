const express = require("express");
const router = express.Router();
const proxyPaymentController = require("../controllers/proxyPaymentController");

router.get("/checkout", proxyPaymentController.serveCheckoutPage);

module.exports = router;


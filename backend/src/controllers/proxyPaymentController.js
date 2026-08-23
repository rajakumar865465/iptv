const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { error } = require("../utils/response");

exports.serveCheckoutPage = async (req, res) => {
  try {
    const { order_id, token, type, return_url } = req.query;

    if (!order_id) {
      return res.status(400).send("Missing order_id");
    }

    // Verify order exists
    let orderResult;
    if (type === "public") {
      orderResult = await db.query(
        "SELECT amount, currency FROM public_orders WHERE order_id = $1 AND status = $2",
        [order_id, "created"]
      );
    } else {
      orderResult = await db.query(
        "SELECT amount, currency FROM payments WHERE transaction_id = $1 AND status = $2",
        [order_id, "pending"]
      );
    }

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found or already paid");
    }

    const order = orderResult.rows[0];
    const amountInPaise = type === "public" ? order.amount : order.amount * 100;

    // Build Razorpay config
    const config = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: amountInPaise,
      currency: order.currency,
      order_id: order_id
    };

    const verifyUrl = type === "public" ? "/api/public/payments/verify" : "/api/payments/razorpay/verify";

    // Load HTML template
    const templatePath = path.join(__dirname, "../views/proxy_checkout.html");
    let html = fs.readFileSync(templatePath, "utf8");

    // Inject config
    html = html.replace("{{{RAZORPAY_CONFIG}}}", JSON.stringify(config));
    html = html.replace("{{TOKEN}}", token || "");
    html = html.replace("{{VERIFY_URL}}", verifyUrl);
    html = html.replace("{{RETURN_URL}}", return_url || "");

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("Error serving proxy checkout:", err);
    res.status(500).send("Internal Server Error");
  }
};


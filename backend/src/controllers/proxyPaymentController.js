const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { error } = require("../utils/response");

exports.serveCheckoutPage = async (req, res) => {
  try {
    const { order_id, token } = req.query;

    if (!order_id || !token) {
      return res.status(400).send("Missing order_id or token");
    }

    // Verify order exists
    const orderResult = await db.query(
      "SELECT amount, currency FROM payments WHERE transaction_id = $1 AND status = $2",
      [order_id, "pending"]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found or already paid");
    }

    const order = orderResult.rows[0];

    // Build Razorpay config
    const config = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount * 100, // in paise
      currency: order.currency,
      order_id: order_id
    };

    // Load HTML template
    const templatePath = path.join(__dirname, "../views/proxy_checkout.html");
    let html = fs.readFileSync(templatePath, "utf8");

    // Inject config
    html = html.replace("{{{RAZORPAY_CONFIG}}}", JSON.stringify(config));
    html = html.replace("{{TOKEN}}", token);

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("Error serving proxy checkout:", err);
    res.status(500).send("Internal Server Error");
  }
};


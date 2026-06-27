const db = require('../config/db');
const { success, error } = require('../utils/response');
const { generateLicenseKey } = require('../utils/helpers');

// Razorpay integration (add to package.json: npm install razorpay)
let razorpay = null;
try {
  razorpay = require('razorpay');
} catch (e) {
  console.log('[Payment] Razorpay not installed - run: npm install razorpay');
}

const razorpayClient = razorpay ? new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'your_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_key_secret'
}) : null;

exports.getPlans = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM plans WHERE status = $1 AND is_visible = true ORDER BY duration_days ASC',
      ['active']
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch plans', 500);
  }
};

exports.getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT p.*, pl.name as plan_name FROM payments p
       LEFT JOIN plans pl ON p.plan_id = pl.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 1`,
      [userId]
    );
    success(res, result.rows[0] || null);
  } catch (err) {
    error(res, 'Failed to fetch payment status', 500);
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { plan_id } = req.body;
    const userId = req.user.id;

    // Get plan details
    const planResult = await db.query('SELECT * FROM plans WHERE id = $1 AND status = $1', [plan_id]);
    if (planResult.rows.length === 0) {
      return error(res, 'Plan not found', 404);
    }
    const plan = planResult.rows[0];

    if (!razorpayClient) {
      return error(res, 'Payment gateway not configured', 503);
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(plan.price * 100), // Razorpay uses paise
      currency: plan.currency || 'INR',
      receipt: `order_${Date.now()}_${userId}`,
      notes: {
        user_id: userId,
        plan_id: plan_id
      }
    };

    const order = await razorpayClient.orders.create(options);

    // Create pending payment record
    const paymentResult = await db.query(
      `INSERT INTO payments (user_id, plan_id, amount, currency, payment_method, transaction_id, status)
       VALUES ($1, $2, $3, $4, 'razorpay', $5, 'pending') RETURNING *`,
      [userId, plan_id, plan.price, plan.currency || 'INR', order.id]
    );

    success(res, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      payment: paymentResult.rows[0]
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err.message);
    error(res, 'Failed to create payment order', 500);
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpayClient) {
      return error(res, 'Payment gateway not configured', 503);
    }

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return error(res, 'Invalid payment signature', 400);
    }

    // Get payment record
    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE transaction_id = $1',
      [razorpay_order_id]
    );
    if (paymentResult.rows.length === 0) {
      return error(res, 'Payment not found', 404);
    }
    const payment = paymentResult.rows[0];

    // Update payment status
    await db.query(
      `UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [payment.id]
    );

    // Create/activate license
    const licenseKey = generateLicenseKey();
    const planResult = await db.query('SELECT * FROM plans WHERE id = $1', [payment.plan_id]);
    const plan = planResult.rows[0];

    await db.query(
      `INSERT INTO licenses (license_key, plan_id, user_id, status, duration_days, max_devices, activated_at, expires_at)
       VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + INTERVAL '1 day' * $4)`,
      [licenseKey, payment.plan_id, payment.user_id, plan.duration_days, plan.max_devices]
    );

    // Update user status if needed
    await db.query('UPDATE users SET status = $1 WHERE id = $2 AND status = $3',
      ['active', payment.user_id, 'blocked']);

    success(res, { success: true, license_key: licenseKey });
  } catch (err) {
    console.error('Payment verification error:', err.message);
    error(res, 'Payment verification failed', 500);
  }
};

exports.manualRequest = async (req, res) => {
  try {
    const { plan_id, amount, payment_method } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `INSERT INTO payments (user_id, plan_id, amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [userId, plan_id, amount, payment_method || 'manual']
    );

    success(res, result.rows[0], 'Payment request submitted', 201);
  } catch (err) {
    error(res, 'Failed to submit payment request', 500);
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT p.*, pl.name as plan_name FROM payments p
       LEFT JOIN plans pl ON p.plan_id = pl.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
      [userId]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch payment history', 500);
  }
};

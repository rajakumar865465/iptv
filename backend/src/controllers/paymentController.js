const crypto = require('crypto');
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

const razorpayClient = (razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

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
    const planResult = await db.query('SELECT * FROM plans WHERE id = $1 AND status = $2', [plan_id, 'active']);
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpayClient) {
    return error(res, 'Payment gateway not configured', 503);
  }

  // Verify signature — always use the env var, never a hardcoded fallback
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return error(res, 'Payment gateway not configured', 503);
  }
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(razorpay_signature || '', 'utf8');
  const signaturesMatch = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!signaturesMatch) {
    return error(res, 'Invalid payment signature', 400);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get payment record
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE transaction_id = $1 FOR UPDATE',
      [razorpay_order_id]
    );
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Payment not found', 404);
    }
    const payment = paymentResult.rows[0];

    // Idempotency: Razorpay may retry verification/webhooks. If this payment is
    // already completed, return the existing license instead of creating a duplicate.
    if (payment.status === 'completed') {
      const existingLicense = await client.query(
        `SELECT license_key FROM licenses
         WHERE user_id = $1 AND plan_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [payment.user_id, payment.plan_id]
      );
      await client.query('ROLLBACK');
      return success(res, {
        success: true,
        license_key: existingLicense.rows[0]?.license_key || null,
        already_processed: true,
      });
    }

    // Update payment status — guard on status to avoid a race between two
    // concurrent verifications creating two licenses.
    const updateResult = await client.query(
      `UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status <> 'completed' RETURNING *`,
      [payment.id]
    );
    if (updateResult.rows.length === 0) {
      // Another request completed it first — treat as already processed
      await client.query('ROLLBACK');
      return success(res, { success: true, already_processed: true });
    }

    // Create/activate license
    const licenseKey = generateLicenseKey();
    const planResult = await client.query('SELECT * FROM plans WHERE id = $1', [payment.plan_id]);
    const plan = planResult.rows[0];
    if (!plan) {
      await client.query('ROLLBACK');
      return error(res, 'Plan not found for this payment', 404);
    }

    await client.query(
      `INSERT INTO licenses (license_key, plan_id, user_id, status, duration_days, max_devices, activated_at, expires_at)
       VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + INTERVAL '1 day' * $4)`,
      [licenseKey, payment.plan_id, payment.user_id, plan.duration_days, plan.max_devices]
    );

    // Update user status if needed
    await client.query('UPDATE users SET status = $1 WHERE id = $2 AND status = $3',
      ['active', payment.user_id, 'blocked']);

    await client.query('COMMIT');

    success(res, { success: true, license_key: licenseKey });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Payment verification error:', err.message);
    error(res, 'Payment verification failed', 500);
  } finally {
    client.release();
  }
};

exports.manualRequest = async (req, res) => {
  try {
    const { plan_id, payment_method } = req.body;
    const userId = req.user.id;

    // Always pull the amount from the plan — never trust client-supplied amount
    const planResult = await db.query('SELECT price FROM plans WHERE id = $1 AND status = $2', [plan_id, 'active']);
    if (planResult.rows.length === 0) {
      return error(res, 'Plan not found or inactive', 404);
    }
    const amount = planResult.rows[0].price;

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

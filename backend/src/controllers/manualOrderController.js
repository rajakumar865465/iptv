const db = require('../config/db');
const { success, error } = require('../utils/response');

function generateOrderId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `NIVA-${year}${month}${day}-${randomStr}`;
}

exports.createOrder = async (req, res) => {
  const { plan_id, full_name, email, mobile, utr_number, payment_date, payment_note } = req.body;
  const userId = req.user?.id || null;

  if (!plan_id || !full_name || !email || !mobile || !utr_number || !payment_date) {
    return error(res, 'All required fields must be provided.', 400);
  }

  // Normalize UTR number
  const normalizedUtr = utr_number.trim();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check for duplicate UTR
    const duplicateCheck = await client.query('SELECT id FROM orders WHERE utr_number = $1', [normalizedUtr]);
    if (duplicateCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return error(res, 'यह UTR पहले ही इस्तेमाल किया जा चुका है। कृपया सही Transaction ID दर्ज करें। (Duplicate UTR)', 400);
    }

    // 2. Get plan price (never trust client amount)
    const planResult = await client.query('SELECT price FROM plans WHERE id = $1 AND status = $2', [plan_id, 'active']);
    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Selected subscription plan is unavailable.', 404);
    }
    const amount = planResult.rows[0].price;

    // 3. Generate Order ID
    let orderId = generateOrderId();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const existing = await client.query('SELECT id FROM orders WHERE order_id = $1', [orderId]);
      if (existing.rows.length === 0) {
        isUnique = true;
      } else {
        orderId = generateOrderId();
        attempts++;
      }
    }

    if (!isUnique) {
      await client.query('ROLLBACK');
      return error(res, 'Failed to generate a unique Order ID. Please try again.', 500);
    }

    // 4. Create Order
    const insertResult = await client.query(
      `INSERT INTO orders 
       (order_id, user_id, plan_id, amount, full_name, email, mobile, utr_number, payment_date, payment_note, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') RETURNING *`,
      [orderId, userId, plan_id, amount, full_name, email, mobile, normalizedUtr, payment_date, payment_note]
    );

    await client.query('COMMIT');
    
    success(res, insertResult.rows[0], 'Order created successfully', 201);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to create manual order:', err);
    error(res, 'Failed to submit payment request.', 500);
  } finally {
    client.release();
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await db.query(
      `SELECT o.*, p.name as plan_name, p.duration_days, p.max_devices 
       FROM orders o 
       JOIN plans p ON o.plan_id = p.id 
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return error(res, 'Order not found.', 404);
    }

    // Optionally check if subscription is active for this order
    const order = result.rows[0];
    const subResult = await db.query('SELECT * FROM subscriptions WHERE order_id = $1', [order.id]);
    
    success(res, {
      ...order,
      subscription: subResult.rows.length > 0 ? subResult.rows[0] : null
    });
  } catch (err) {
    console.error('Failed to fetch order:', err);
    error(res, 'Failed to fetch order details.', 500);
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT o.*, p.name as plan_name 
       FROM orders o 
       JOIN plans p ON o.plan_id = p.id 
       WHERE o.user_id = $1 
       ORDER BY o.created_at DESC`,
      [userId]
    );
    success(res, result.rows);
  } catch (err) {
    console.error('Failed to fetch user orders:', err);
    error(res, 'Failed to fetch your orders.', 500);
  }
};

exports.getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT s.*, p.name as plan_name 
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 
       ORDER BY s.expiry_date DESC LIMIT 1`,
      [userId]
    );
    success(res, result.rows.length > 0 ? result.rows[0] : null);
  } catch (err) {
    console.error('Failed to fetch user subscription:', err);
    error(res, 'Failed to fetch your subscription.', 500);
  }
};

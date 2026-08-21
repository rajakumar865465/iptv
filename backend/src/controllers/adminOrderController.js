const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { status, search, date } = req.query;

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClauses.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }

    if (search) {
      whereClauses.push(`(o.order_id ILIKE $${paramIndex} OR o.email ILIKE $${paramIndex} OR o.mobile ILIKE $${paramIndex} OR o.utr_number ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (date) {
      whereClauses.push(`o.created_at::date = $${paramIndex++}`);
      params.push(date);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM orders o ${whereStr}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT o.*, p.name as plan_name
       FROM orders o 
       LEFT JOIN plans p ON o.plan_id = p.id
       ${whereStr} 
       ORDER BY o.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    success(res, { data: result.rows, pagination: { page, limit, total } });
  } catch (err) {
    console.error('Failed to get orders:', err);
    error(res, 'Failed to fetch orders.', 500);
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT o.*, p.name as plan_name, p.duration_days, 
              u.full_name as approved_by_name
       FROM orders o 
       LEFT JOIN plans p ON o.plan_id = p.id
       LEFT JOIN users u ON o.approved_by = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Order not found.', 404);
    }

    const order = result.rows[0];

    const subResult = await db.query('SELECT * FROM subscriptions WHERE order_id = $1', [id]);
    
    success(res, {
      ...order,
      subscription: subResult.rows.length > 0 ? subResult.rows[0] : null
    });
  } catch (err) {
    console.error('Failed to get order details:', err);
    error(res, 'Failed to fetch order details.', 500);
  }
};

exports.approveOrder = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the order row and check status
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order not found.', 404);
    }

    const order = orderResult.rows[0];
    if (order.status === 'approved') {
      await client.query('ROLLBACK');
      return error(res, 'This order has already been approved.', 400);
    }
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return error(res, `Cannot approve order with status: ${order.status}`, 400);
    }

    // 2. Mark order as approved
    await client.query(
      `UPDATE orders 
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $2`,
      [adminId, id]
    );

    // 3. Get plan details
    const planResult = await client.query('SELECT duration_days FROM plans WHERE id = $1', [order.plan_id]);
    const durationDays = planResult.rows[0]?.duration_days || 30;

    // 4. Calculate subscription dates (stack if active)
    let startDate = new Date();
    let expiryDate = new Date();
    
    // Check if user has an active subscription
    const existingSub = await client.query(
      `SELECT expiry_date FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY expiry_date DESC LIMIT 1`,
      [order.user_id]
    );

    if (existingSub.rows.length > 0 && new Date(existingSub.rows[0].expiry_date) > new Date()) {
      startDate = new Date(existingSub.rows[0].expiry_date);
    }
    expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 5. Create or update subscription
    await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, order_id, status, start_date, expiry_date) 
       VALUES ($1, $2, $3, 'active', $4, $5)`,
      [order.user_id, order.plan_id, id, startDate, expiryDate]
    );

    // Update user status
    if (order.user_id) {
       await client.query("UPDATE users SET status = 'active' WHERE id = $1 AND status = 'blocked'", [order.user_id]);
    }

    // 6. Log admin action
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'APPROVE_ORDER', 'orders', id, JSON.stringify({ order_id: order.order_id })]
    );

    await client.query('COMMIT');
    success(res, null, 'Order approved successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to approve order:', err);
    error(res, 'Failed to approve order.', 500);
  } finally {
    client.release();
  }
};

exports.rejectOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the order row and check status
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order not found.', 404);
    }

    const order = orderResult.rows[0];
    if (order.status === 'rejected') {
      await client.query('ROLLBACK');
      return error(res, 'This order has already been rejected.', 400);
    }
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return error(res, `Cannot reject order with status: ${order.status}`, 400);
    }

    // 2. Mark order as rejected
    await client.query(
      `UPDATE orders 
       SET status = 'rejected', rejection_reason = $1, rejected_at = NOW(), updated_at = NOW() 
       WHERE id = $2`,
      [reason || 'No reason provided', id]
    );

    // 3. Log admin action
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'REJECT_ORDER', 'orders', id, JSON.stringify({ order_id: order.order_id, reason })]
    );

    await client.query('COMMIT');
    success(res, null, 'Order rejected successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to reject order:', err);
    error(res, 'Failed to reject order.', 500);
  } finally {
    client.release();
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_orders,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_orders,
        SUM(amount) FILTER (WHERE status = 'approved' AND DATE(approved_at) = CURRENT_DATE) as today_revenue,
        SUM(amount) FILTER (WHERE status = 'approved') as total_revenue
      FROM orders
    `);

    const activeSubsResult = await db.query(`SELECT COUNT(*) as active_subscriptions FROM subscriptions WHERE status = 'active' AND expiry_date > NOW()`);

    const stats = statsResult.rows[0];
    success(res, {
      pendingOrders: parseInt(stats.pending_orders) || 0,
      approvedOrders: parseInt(stats.approved_orders) || 0,
      rejectedOrders: parseInt(stats.rejected_orders) || 0,
      todayRevenue: parseFloat(stats.today_revenue) || 0,
      totalRevenue: parseFloat(stats.total_revenue) || 0,
      activeSubscriptions: parseInt(activeSubsResult.rows[0].active_subscriptions) || 0
    });
  } catch (err) {
    console.error('Failed to fetch order stats:', err);
    error(res, 'Failed to fetch order stats.', 500);
  }
};

exports.getPaymentMode = async (req, res) => {
  try {
    const result = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'payment_mode'");
    success(res, { mode: result.rows.length > 0 ? result.rows[0].setting_value : 'razorpay' });
  } catch (err) {
    error(res, 'Failed to fetch payment mode.', 500);
  }
};

exports.setPaymentMode = async (req, res) => {
  const { mode } = req.body;
  if (!['manual', 'razorpay'].includes(mode)) {
    return error(res, 'Invalid payment mode.', 400);
  }
  try {
    await db.query(
      "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES ('payment_mode', $1, NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()",
      [mode]
    );
    success(res, { mode }, 'Payment mode updated successfully.');
  } catch (err) {
    error(res, 'Failed to update payment mode.', 500);
  }
};

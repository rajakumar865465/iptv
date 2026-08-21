const db = require('../config/db');
const { success, error } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');
const { sendMail } = require('../utils/mailer');
const paymentSettings = require('../services/paymentSettings');
const { activateLicense, remainingDays } = require('../services/subscriptionService');

/**
 * Manual UPI payment flow — admin half.
 *
 * The authoritative record of a payment is the merchant's bank / UPI account.
 * A submitted UTR, screenshot or WhatsApp message proves nothing on its own.
 * Approval here is an explicit statement by an authenticated admin that they have
 * seen the money arrive, and it is the ONLY thing in the system that activates a
 * subscription.
 */

const ORDER_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];

// Whitelist — user input is never interpolated into ORDER BY.
const SORTABLE = {
  created_at: 'po.created_at',
  submitted_at: 'po.submitted_at',
  amount: 'po.amount',
  status: 'po.status',
  approved_at: 'po.approved_at',
};

const requestMeta = (req) => ({
  ip_address: req.ip || null,
  user_agent: req.headers['user-agent'] || null,
});

/** Rupees for display — public_orders.amount is stored as an integer number of paise. */
const toRupees = (paise) => Number(paise || 0) / 100;

const APP_NAME = () => process.env.APP_NAME || 'NivaTV';

/**
 * Fire-and-forget customer notification. Called only after COMMIT and never
 * awaited by the request, so an unreachable mail server cannot undo an approval
 * or block the admin's response.
 */
function notifyCustomer(payload) {
  sendMail(payload).catch((err) => {
    console.error('Order notification email failed (approval is unaffected):', err.message);
  });
}

function shapeOrder(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    payment_mode: row.payment_mode,
    status: row.status,
    plan_id: row.plan_id,
    plan_name: row.plan_name,
    duration_days: row.duration_days,
    max_devices: row.max_devices,
    amount: toRupees(row.amount),
    currency: row.currency,
    customer_name: row.customer_name,
    email: row.email,
    mobile: row.mobile,
    user_id: row.user_id,
    utr_number: row.utr_number,
    payment_date: row.payment_date,
    payment_note: row.payment_note,
    submitted_at: row.submitted_at || row.created_at,
    created_at: row.created_at,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    approved_by_name: row.approved_by_name || null,
    rejected_at: row.rejected_at,
    rejection_reason: row.rejection_reason,
    license_key: row.license_key || null,
    license_status: row.license_status || null,
    subscription_start: row.activated_at || null,
    subscription_expiry: row.expires_at || null,
    remaining_days: row.expires_at ? remainingDays(row.expires_at) : 0,
  };
}

const ORDER_SELECT = `
  SELECT po.id, po.order_id, po.payment_mode, po.status, po.plan_id, po.amount, po.currency,
         po.customer_name, po.email, po.mobile, po.user_id, po.utr_number, po.payment_date,
         po.payment_note, po.submitted_at, po.created_at, po.approved_at, po.approved_by,
         po.rejected_at, po.rejection_reason,
         COALESCE(po.plan_name_snapshot, p.name) AS plan_name,
         COALESCE(po.duration_days_snapshot, p.duration_days) AS duration_days,
         COALESCE(po.max_devices_snapshot, p.max_devices) AS max_devices,
         u.full_name AS approved_by_name,
         l.license_key, l.status AS license_status, l.activated_at, l.expires_at
    FROM public_orders po
    LEFT JOIN plans p ON po.plan_id = p.id
    LEFT JOIN users u ON po.approved_by = u.id
    LEFT JOIN licenses l ON po.license_id = l.id`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/internal/orders
// ─────────────────────────────────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    // Defaults to the manual verification queue; ?mode=all also shows gateway history.
    if (req.query.mode !== 'all') {
      params.push(req.query.mode === 'razorpay' ? 'razorpay' : 'manual');
      conditions.push(`po.payment_mode = $${params.length}`);
    }

    if (req.query.status && ORDER_STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      conditions.push(`po.status = $${params.length}`);
    }

    const search = String(req.query.search ?? '').trim();
    if (search) {
      params.push(`%${search}%`);
      const like = `$${params.length}`;
      // UTR matches the normalized copy so an admin can paste it with spaces/dashes.
      params.push(`%${search.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`);
      const utrLike = `$${params.length}`;
      conditions.push(`(
        po.order_id ILIKE ${like}
        OR po.email ILIKE ${like}
        OR po.mobile ILIKE ${like}
        OR po.customer_name ILIKE ${like}
        OR po.utr_normalized LIKE ${utrLike}
      )`);
    }

    if (req.query.date_from) {
      params.push(String(req.query.date_from));
      conditions.push(`po.created_at >= $${params.length}::date`);
    }
    if (req.query.date_to) {
      params.push(String(req.query.date_to));
      // Inclusive of the whole end day.
      conditions.push(`po.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (req.query.plan_id) {
      const planId = parseInt(req.query.plan_id, 10);
      if (Number.isInteger(planId)) {
        params.push(planId);
        conditions.push(`po.plan_id = $${params.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE[req.query.sort_by] || SORTABLE.created_at;
    const sortDir = String(req.query.sort_dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM public_orders po ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    const rows = await db.query(
      `${ORDER_SELECT} ${where}
       ORDER BY ${sortColumn} ${sortDir} NULLS LAST, po.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return success(res, {
      orders: rows.rows.map(shapeOrder),
      pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error('getOrders error:', err.message);
    return error(res, 'Failed to fetch orders', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/internal/orders/summary
// ─────────────────────────────────────────────────────────────────────────────
exports.getOrderSummary = async (req, res) => {
  try {
    const orders = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_count,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
         COALESCE(SUM(amount) FILTER (
           WHERE status = 'approved' AND approved_at >= CURRENT_DATE
         ), 0) AS today_revenue_paise,
         COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS total_revenue_paise
       FROM public_orders
       WHERE payment_mode = 'manual'`
    );

    // Expiry is evaluated live rather than trusting the status flag alone, so a
    // delayed expiry job can never inflate this number.
    const subs = await db.query(
      `SELECT COUNT(*)::int AS active
         FROM licenses
        WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at > NOW()`
    );

    const row = orders.rows[0];
    return success(res, {
      pending_count: row.pending_count,
      approved_count: row.approved_count,
      rejected_count: row.rejected_count,
      today_revenue: toRupees(row.today_revenue_paise),
      total_revenue: toRupees(row.total_revenue_paise),
      active_subscriptions: subs.rows[0].active,
    });
  } catch (err) {
    console.error('getOrderSummary error:', err.message);
    return error(res, 'Failed to fetch order summary', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/internal/orders/:orderId
// ─────────────────────────────────────────────────────────────────────────────
exports.getOrderDetail = async (req, res) => {
  try {
    const result = await db.query(`${ORDER_SELECT} WHERE po.order_id = $1`, [String(req.params.orderId)]);
    if (result.rows.length === 0) return error(res, 'Order not found', 404);

    const order = shapeOrder(result.rows[0]);

    // Prior orders from the same customer — useful context when judging a claim.
    const history = await db.query(
      `SELECT order_id, status, amount, created_at, approved_at
         FROM public_orders
        WHERE id <> $1 AND (LOWER(email) = LOWER($2) OR mobile = $3)
        ORDER BY created_at DESC
        LIMIT 10`,
      [order.id, order.email || '', order.mobile || '']
    );

    return success(res, {
      ...order,
      customer_history: history.rows.map((r) => ({
        order_id: r.order_id,
        status: r.status,
        amount: toRupees(r.amount),
        created_at: r.created_at,
        approved_at: r.approved_at,
      })),
    });
  } catch (err) {
    console.error('getOrderDetail error:', err.message);
    return error(res, 'Failed to fetch order details', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/orders/:orderId/approve
// The single path that activates a subscription. Admin-only, single-use, audited.
// ─────────────────────────────────────────────────────────────────────────────
exports.approveOrder = async (req, res) => {
  const orderId = String(req.params.orderId ?? '').trim();
  const adminId = req.user.id;
  const client = await db.pool.connect();
  let approved = null;
  let customer = null;

  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT po.*,
              COALESCE(po.plan_name_snapshot, p.name) AS plan_name,
              COALESCE(po.duration_days_snapshot, p.duration_days) AS duration_days,
              COALESCE(po.max_devices_snapshot, p.max_devices) AS max_devices
         FROM public_orders po
         LEFT JOIN plans p ON po.plan_id = p.id
        WHERE po.order_id = $1
        FOR UPDATE OF po`,
      [orderId]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order not found', 404);
    }

    const order = found.rows[0];
    if (order.payment_mode !== 'manual') {
      await client.query('ROLLBACK');
      return error(res, 'This is a gateway order and cannot be approved manually.', 400);
    }
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return error(res, 'Order has already been processed.', 409);
    }
    if (!order.plan_id || !order.duration_days) {
      await client.query('ROLLBACK');
      return error(res, 'This order has no valid plan attached and cannot be approved.', 422);
    }

    // Conditional update alongside the row lock: if a concurrent request already
    // moved this order on, rowCount is 0 and we stop instead of double-activating.
    const claimed = await client.query(
      `UPDATE public_orders
          SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
        WHERE id = $2 AND status = 'pending'
        RETURNING approved_at`,
      [adminId, order.id]
    );
    if (claimed.rowCount === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order has already been processed.', 409);
    }

    // payments.amount is DECIMAL(10,2) in rupees.
    const amountRupees = toRupees(order.amount);
    const paymentInsert = await client.query(
      `INSERT INTO payments
         (user_id, plan_id, amount, currency, payment_method, transaction_id, status,
          order_id, customer_name, mobile, email, approved_by, approved_at, paid_at)
       VALUES ($1, $2, $3, $4, 'upi_manual', $5, 'completed',
               $6, $7, $8, $9, $10, NOW(), COALESCE($11::timestamptz, NOW()))
       RETURNING id`,
      [
        order.user_id, order.plan_id, amountRupees, order.currency || 'INR', order.utr_number,
        order.order_id, order.customer_name, order.mobile, order.email, adminId,
        order.payment_date ? new Date(order.payment_date).toISOString() : null,
      ]
    );

    const settings = await paymentSettings.getPaymentSettings();
    const license = await activateLicense(client, {
      planId: order.plan_id,
      durationDays: order.duration_days,
      maxDevices: order.max_devices || 1,
      userId: order.user_id,
      customerEmail: order.email,
      paymentId: paymentInsert.rows[0].id,
      stackingEnabled: settings.stacking_enabled,
    });

    await client.query(
      `UPDATE public_orders SET license_id = $1, updated_at = NOW() WHERE id = $2`,
      [license.licenseId, order.id]
    );

    await logAudit({
      client,
      admin_id: adminId,
      action: 'manual_order_approved',
      target_type: 'public_order',
      target_id: String(order.order_id),
      old_value: { status: 'pending' },
      new_value: {
        status: 'approved',
        amount: amountRupees,
        utr_number: order.utr_number,
        license_id: license.licenseId,
        expires_at: license.expiresAt,
        stacked: license.stacked,
      },
      reason: 'Payment verified in merchant bank/UPI account',
      ...requestMeta(req),
    });

    await client.query('COMMIT');

    approved = {
      order_id: order.order_id,
      status: 'approved',
      approved_at: claimed.rows[0].approved_at,
      plan_name: order.plan_name,
      amount: amountRupees,
      license_key: license.licenseKey,
      subscription_start: license.startDate,
      subscription_expiry: license.expiresAt,
      remaining_days: remainingDays(license.expiresAt),
      stacked: license.stacked,
    };
    customer = { email: order.email, name: order.customer_name };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('approveOrder error:', err.message);
    return error(res, 'Failed to approve order', 500);
  } finally {
    client.release();
  }

  if (customer.email) {
    const expiry = new Date(approved.subscription_expiry).toDateString();
    notifyCustomer({
      to: customer.email,
      subject: `${APP_NAME()} — Payment verified, your subscription is active`,
      text:
        `Hi ${customer.name || 'there'},\n\n` +
        `We have verified your payment for order ${approved.order_id}.\n\n` +
        `Plan: ${approved.plan_name}\n` +
        `Amount: ₹${approved.amount.toFixed(2)}\n` +
        `License key: ${approved.license_key}\n` +
        `Valid until: ${expiry} (${approved.remaining_days} days)\n\n` +
        `Open the ${APP_NAME()} app and enter the license key above to start watching.\n\n` +
        `Thank you!`,
    });
  }

  return success(res, approved, 'Payment approved and subscription activated');
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/orders/:orderId/reject   body: { reason }
// ─────────────────────────────────────────────────────────────────────────────
exports.rejectOrder = async (req, res) => {
  const orderId = String(req.params.orderId ?? '').trim();
  const adminId = req.user.id;
  const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
  if (!reason) return error(res, 'A rejection reason is required', 400);

  const client = await db.pool.connect();
  let rejected = null;
  let customer = null;

  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT po.id, po.order_id, po.status, po.payment_mode, po.email, po.customer_name, po.amount,
              COALESCE(po.plan_name_snapshot, p.name) AS plan_name
         FROM public_orders po
         LEFT JOIN plans p ON po.plan_id = p.id
        WHERE po.order_id = $1
        FOR UPDATE OF po`,
      [orderId]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order not found', 404);
    }

    const order = found.rows[0];
    if (order.payment_mode !== 'manual') {
      await client.query('ROLLBACK');
      return error(res, 'This is a gateway order and cannot be rejected manually.', 400);
    }
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return error(res, 'Order has already been processed.', 409);
    }

    const claimed = await client.query(
      `UPDATE public_orders
          SET status = 'rejected', rejection_reason = $1, rejected_at = NOW(),
              approved_by = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'pending'
        RETURNING rejected_at`,
      [reason, adminId, order.id]
    );
    if (claimed.rowCount === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order has already been processed.', 409);
    }

    await logAudit({
      client,
      admin_id: adminId,
      action: 'manual_order_rejected',
      target_type: 'public_order',
      target_id: String(order.order_id),
      old_value: { status: 'pending' },
      new_value: { status: 'rejected' },
      reason,
      ...requestMeta(req),
    });

    await client.query('COMMIT');

    rejected = {
      order_id: order.order_id,
      status: 'rejected',
      rejected_at: claimed.rows[0].rejected_at,
      rejection_reason: reason,
      plan_name: order.plan_name,
      amount: toRupees(order.amount),
    };
    customer = { email: order.email, name: order.customer_name };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('rejectOrder error:', err.message);
    return error(res, 'Failed to reject order', 500);
  } finally {
    client.release();
  }

  if (customer.email) {
    const settings = await paymentSettings.getPaymentSettings().catch(() => ({ whatsapp_admin_number: '' }));
    notifyCustomer({
      to: customer.email,
      subject: `${APP_NAME()} — We could not verify your payment (order ${rejected.order_id})`,
      text:
        `Hi ${customer.name || 'there'},\n\n` +
        `We were unable to verify the payment for order ${rejected.order_id}.\n\n` +
        `Reason: ${rejected.rejection_reason}\n\n` +
        `If you believe this is a mistake, reply to this email with your payment ` +
        `screenshot` +
        (settings.whatsapp_admin_number ? ` or message us on WhatsApp at +${settings.whatsapp_admin_number}` : '') +
        `, quoting order ${rejected.order_id}.\n\n` +
        `No amount has been charged by us for this order. If money left your account, ` +
        `it will normally be returned by your bank automatically.\n\n` +
        `Thank you for your patience.`,
    });
  }

  return success(res, rejected, 'Order rejected');
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/internal/payment-settings
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentSettings = async (req, res) => {
  try {
    const settings = await paymentSettings.getPaymentSettings();
    const problems = paymentSettings.validateManualConfig(settings);
    return success(res, {
      payment_mode: settings.payment_mode,
      available_modes: paymentSettings.PAYMENT_MODES,
      upi_id: settings.upi_id,
      upi_merchant_name: settings.upi_merchant_name,
      whatsapp_admin_number: settings.whatsapp_admin_number,
      payment_currency: settings.payment_currency,
      payment_qr_url: settings.payment_qr_url,
      manual_payment_instructions: settings.manual_payment_instructions,
      subscription_stacking: settings.stacking_enabled,
      // Surfaced so the admin UI can explain *why* a mode is unavailable.
      manual_ready: problems.length === 0,
      manual_config_problems: problems,
      razorpay_ready: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    });
  } catch (err) {
    console.error('getPaymentSettings error:', err.message);
    return error(res, 'Failed to fetch payment settings', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/internal/payment-settings
// The admin-controlled switch between manual UPI and the Razorpay gateway.
// Razorpay is never removed from the codebase — it is simply not the active mode.
// ─────────────────────────────────────────────────────────────────────────────
exports.updatePaymentSettings = async (req, res) => {
  try {
    const body = req.body || {};
    const current = await paymentSettings.getPaymentSettings();
    const updates = {};

    if (body.payment_mode !== undefined) {
      if (!paymentSettings.PAYMENT_MODES.includes(body.payment_mode)) {
        return error(res, `payment_mode must be one of: ${paymentSettings.PAYMENT_MODES.join(', ')}`, 400);
      }
      updates.payment_mode = body.payment_mode;
    }

    if (body.upi_id !== undefined) {
      const upiId = String(body.upi_id).trim();
      if (upiId && !paymentSettings.isValidUpiId(upiId)) {
        return error(res, 'Enter a valid UPI ID, for example name@bank', 400);
      }
      updates.upi_id = upiId;
    }

    if (body.upi_merchant_name !== undefined) {
      const merchant = String(body.upi_merchant_name).trim().slice(0, 100);
      // UPI payee names reject most punctuation.
      if (merchant && !/^[a-zA-Z0-9 .&'-]+$/.test(merchant)) {
        return error(res, "Merchant name can only contain letters, numbers, spaces and . & ' -", 400);
      }
      updates.upi_merchant_name = merchant;
    }

    if (body.whatsapp_admin_number !== undefined) {
      const raw = String(body.whatsapp_admin_number).trim();
      if (raw) {
        const normalized = paymentSettings.normalizeWhatsAppNumber(raw);
        if (!normalized) {
          return error(res, 'Enter a WhatsApp number in international format, for example 919876543210', 400);
        }
        updates.whatsapp_admin_number = normalized;
      } else {
        updates.whatsapp_admin_number = '';
      }
    }

    if (body.payment_qr_url !== undefined) {
      const url = String(body.payment_qr_url).trim();
      if (url && !/^(https?:\/\/|\/)/.test(url)) {
        return error(res, 'QR image URL must start with http(s):// or /', 400);
      }
      updates.payment_qr_url = url.slice(0, 500);
    }

    if (body.manual_payment_instructions !== undefined) {
      updates.manual_payment_instructions = String(body.manual_payment_instructions).trim().slice(0, 1000);
    }

    if (body.subscription_stacking !== undefined) {
      updates.subscription_stacking = body.subscription_stacking ? 'true' : 'false';
    }

    if (Object.keys(updates).length === 0) return error(res, 'No settings to update', 400);

    // Guard: don't let a mode be switched on while it is unusable — that would
    // strand customers on a checkout page with no way to pay.
    const effective = { ...current, ...updates };
    if (paymentSettings.isFlowEnabled(effective.payment_mode, 'manual')) {
      const problems = paymentSettings.validateManualConfig(effective);
      if (problems.length > 0) {
        return error(res, `Cannot enable manual payment: ${problems.join('; ')}.`, 422);
      }
    }
    if (effective.payment_mode === 'razorpay' && !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)) {
      return error(res, 'Cannot switch to Razorpay: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.', 422);
    }

    const keys = Object.keys(updates);
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       SELECT t.key, t.value, NOW() FROM UNNEST($1::text[], $2::text[]) AS t(key, value)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [keys, keys.map((k) => String(updates[k] ?? ''))]
    );

    await logAudit({
      admin_id: req.user.id,
      action: 'payment_settings_updated',
      target_type: 'app_settings',
      target_id: 'payment',
      old_value: Object.fromEntries(keys.map((k) => [k, current[k]])),
      new_value: updates,
      reason: updates.payment_mode ? `Payment mode set to ${updates.payment_mode}` : 'Payment settings updated',
      ...requestMeta(req),
    });

    const saved = await paymentSettings.getPaymentSettings();
    return success(res, {
      payment_mode: saved.payment_mode,
      upi_id: saved.upi_id,
      upi_merchant_name: saved.upi_merchant_name,
      whatsapp_admin_number: saved.whatsapp_admin_number,
      payment_currency: saved.payment_currency,
      payment_qr_url: saved.payment_qr_url,
      manual_payment_instructions: saved.manual_payment_instructions,
      subscription_stacking: saved.stacking_enabled,
    }, 'Payment settings updated');
  } catch (err) {
    console.error('updatePaymentSettings error:', err.message);
    return error(res, 'Failed to update payment settings', 500);
  }
};

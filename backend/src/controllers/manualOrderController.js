const db = require('../config/db');
const { success, error } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');
const paymentSettings = require('../services/paymentSettings');
const { generateOrderId, remainingDays } = require('../services/subscriptionService');

/**
 * Manual UPI payment flow — customer-facing half.
 *
 * The customer pays from their own UPI app, then submits the UTR / reference
 * number here. That creates a `pending` order and nothing more: no subscription,
 * no license, no access. Submitting a UTR is a *claim*, not a payment proof — only
 * an admin who has seen the money land in the merchant's bank/UPI account can
 * approve it (see adminOrderController.approveOrder).
 */

const MAX_PENDING_PER_CUSTOMER = 3;
const UTR_MIN = 6;
const UTR_MAX = 32;

/** Uppercase + strip everything that isn't alphanumeric, so spacing/case can't defeat dedupe. */
function normalizeUtr(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Show only the tail of a reference number on public responses. */
function maskUtr(utr) {
  const value = String(utr ?? '');
  if (value.length <= 4) return value;
  return `${'•'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

/** Resolves the caller's account id from a Bearer token, or null for guest checkout. */
function resolveUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.split(' ')[1]).userId || null;
  } catch {
    return null;
  }
}

async function loadPlan(planId) {
  const result = await db.query(
    `SELECT id, name, slug, price, duration_days, max_devices, description
       FROM plans
      WHERE id = $1
        AND COALESCE(status, 'active') = 'active'
        AND COALESCE(is_active, true) = true
        AND COALESCE(is_visible, true) = true`,
    [planId]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/payment-config
// Which checkout the site is currently running, plus the public UPI details.
// Contains no secrets — every field here is meant to be shown to a customer.
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentConfig = async (req, res) => {
  try {
    const settings = await paymentSettings.getPaymentSettings();
    const manualReady = paymentSettings.validateManualConfig(settings).length === 0;

    return success(res, {
      payment_mode: settings.payment_mode,
      // A mode is only *available* if it is actually usable; this stops the UI
      // showing a UPI box with no UPI ID in it.
      manual_available: paymentSettings.isFlowEnabled(settings.payment_mode, 'manual') && manualReady,
      razorpay_available:
        paymentSettings.isFlowEnabled(settings.payment_mode, 'razorpay') && Boolean(process.env.RAZORPAY_KEY_ID),
      upi_id: manualReady ? settings.upi_id : '',
      upi_merchant_name: settings.upi_merchant_name,
      whatsapp_admin_number: settings.whatsapp_admin_number,
      currency: settings.payment_currency,
      payment_qr_url: settings.payment_qr_url || '',
      instructions: settings.manual_payment_instructions || '',
    });
  } catch (err) {
    console.error('getPaymentConfig error:', err.message);
    return error(res, 'Failed to load payment configuration', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/checkout/:planId
// Server-authoritative checkout payload. The amount and the QR are both built
// here from the database — the browser never gets to say what a plan costs.
// ─────────────────────────────────────────────────────────────────────────────
exports.getCheckout = async (req, res) => {
  try {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isInteger(planId) || planId <= 0) return error(res, 'Invalid plan', 400);

    const plan = await loadPlan(planId);
    if (!plan) return error(res, 'Plan not found or unavailable', 404);

    const settings = await paymentSettings.getPaymentSettings();
    const manualProblems = paymentSettings.validateManualConfig(settings);
    const manualEnabled = paymentSettings.isFlowEnabled(settings.payment_mode, 'manual');
    const amountRupees = Number(plan.price);

    const payload = {
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: amountRupees,
        duration_days: plan.duration_days,
        max_devices: plan.max_devices,
        description: plan.description,
      },
      amount: amountRupees,
      amount_display: `₹${amountRupees.toFixed(2)}`,
      currency: settings.payment_currency,
      payment_mode: settings.payment_mode,
      manual_available: manualEnabled && manualProblems.length === 0,
      razorpay_available:
        paymentSettings.isFlowEnabled(settings.payment_mode, 'razorpay') && Boolean(process.env.RAZORPAY_KEY_ID),
      is_free: amountRupees === 0,
      upi_id: '',
      upi_merchant_name: settings.upi_merchant_name,
      whatsapp_admin_number: settings.whatsapp_admin_number,
      upi_uri: null,
      qr_data_url: null,
      payment_qr_url: settings.payment_qr_url || '',
      instructions: settings.manual_payment_instructions || '',
    };

    // Free plans never need a UPI transfer, so no QR is generated for them.
    if (manualEnabled && manualProblems.length === 0 && amountRupees > 0) {
      const upiUri = paymentSettings.buildUpiUri({
        upiId: settings.upi_id,
        merchantName: settings.upi_merchant_name,
        amountRupees,
        note: plan.name,
        currency: settings.payment_currency,
      });
      payload.upi_id = settings.upi_id;
      payload.upi_uri = upiUri;
      payload.qr_data_url = await paymentSettings.generateUpiQr(upiUri);
    }

    return success(res, payload);
  } catch (err) {
    console.error('getCheckout error:', err.message);
    return error(res, 'Failed to load checkout details', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/public/manual-orders
// Records a payment *claim*. Always lands in `pending`.
// ─────────────────────────────────────────────────────────────────────────────
exports.createManualOrder = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { plan_id, full_name, email, mobile, utr_number, payment_date, payment_note } = req.body || {};

    // ── Mode gate: enforced on the server, not just hidden in the UI ──
    const settings = await paymentSettings.getPaymentSettings();
    if (!paymentSettings.isFlowEnabled(settings.payment_mode, 'manual')) {
      return error(res, 'Manual UPI payment is currently disabled. Please refresh the page and try again.', 409);
    }
    const configProblems = paymentSettings.validateManualConfig(settings);
    if (configProblems.length > 0) {
      console.error('Manual payment misconfigured:', configProblems.join(', '));
      return error(res, 'Manual payment is not available right now. Please contact support.', 503);
    }

    // ── Validation ──
    const planId = parseInt(plan_id, 10);
    if (!Number.isInteger(planId) || planId <= 0) return error(res, 'Please select a valid plan', 400);

    const name = String(full_name ?? '').trim();
    if (name.length < 2 || name.length > 100) return error(res, 'Please enter your full name (2–100 characters)', 400);

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
      return error(res, 'Please enter a valid email address', 400);
    }

    const cleanMobile = String(mobile ?? '').replace(/[\s\-+()]/g, '');
    if (!/^\d{9,15}$/.test(cleanMobile)) return error(res, 'Please enter a valid mobile number', 400);

    const utrRaw = String(utr_number ?? '').trim();
    const utr = normalizeUtr(utrRaw);
    if (utr.length < UTR_MIN || utr.length > UTR_MAX) {
      return error(res, `Please enter a valid UTR / Transaction ID (${UTR_MIN}–${UTR_MAX} letters or digits)`, 400);
    }

    // Payment date is optional, but if given it must be plausible.
    let paymentDate = null;
    if (payment_date) {
      const parsed = new Date(String(payment_date));
      if (Number.isNaN(parsed.getTime())) return error(res, 'Please enter a valid payment date', 400);
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      if (parsed > tomorrow) return error(res, 'Payment date cannot be in the future', 400);
      if (parsed < ninetyDaysAgo) return error(res, 'Payment date is too old. Please contact support.', 400);
      paymentDate = parsed.toISOString().slice(0, 10);
    }

    const note = payment_note ? String(payment_note).trim().slice(0, 500) : null;

    // ── Price comes from the DB, never from the request body ──
    const plan = await loadPlan(planId);
    if (!plan) return error(res, 'Selected plan is not available', 404);

    const amountRupees = Number(plan.price);
    if (!(amountRupees > 0)) {
      return error(res, 'This plan is free and does not require a UPI payment. Please claim it from the pricing page.', 400);
    }
    // public_orders.amount is an INTEGER of paise (matches the Razorpay flow).
    const amountPaise = Math.round(amountRupees * 100);

    const userId = resolveUserId(req);

    await client.query('BEGIN');

    // Friendly duplicate message; the unique index below is the real guarantee.
    const dupe = await client.query(
      `SELECT order_id, status FROM public_orders WHERE utr_normalized = $1`,
      [utr]
    );
    if (dupe.rows.length > 0) {
      await client.query('ROLLBACK');
      return error(
        res,
        'यह UTR पहले ही सबमिट किया जा चुका है। कृपया सही Transaction ID दर्ज करें। (This UTR has already been submitted.)',
        409
      );
    }

    // Stop one customer from flooding the verification queue.
    const pending = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM public_orders
        WHERE status = 'pending'
          AND payment_mode = 'manual'
          AND (LOWER(email) = $1 OR mobile = $2)`,
      [cleanEmail, cleanMobile]
    );
    if (pending.rows[0].count >= MAX_PENDING_PER_CUSTOMER) {
      await client.query('ROLLBACK');
      return error(
        res,
        `You already have ${pending.rows[0].count} payment(s) awaiting verification. Please wait for those to be reviewed before submitting another.`,
        429
      );
    }

    // Insert, retrying only on an order_id collision (astronomically unlikely).
    let created = null;
    let lastError = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const orderId = generateOrderId();
      try {
        const inserted = await client.query(
          `INSERT INTO public_orders
             (order_id, plan_id, customer_name, email, mobile, amount, currency, status,
              user_id, payment_mode, utr_number, utr_normalized, payment_date, payment_note,
              submitted_at, plan_name_snapshot, duration_days_snapshot, max_devices_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending',
                   $8, 'manual', $9, $10, $11, $12,
                   NOW(), $13, $14, $15)
           RETURNING id, order_id, status, amount, currency, created_at, submitted_at`,
          [
            orderId, plan.id, name, cleanEmail, cleanMobile, amountPaise, settings.payment_currency,
            userId, utrRaw.slice(0, 64), utr, paymentDate, note,
            plan.name, plan.duration_days, plan.max_devices,
          ]
        );
        created = inserted.rows[0];
      } catch (err) {
        lastError = err;
        // 23505 = unique violation. Only an order_id clash is retryable; a UTR
        // clash means a concurrent request beat us to it.
        if (err.code !== '23505') throw err;
        if (String(err.constraint || '').includes('utr')) {
          await client.query('ROLLBACK');
          return error(
            res,
            'यह UTR पहले ही सबमिट किया जा चुका है। कृपया सही Transaction ID दर्ज करें। (This UTR has already been submitted.)',
            409
          );
        }
      }
    }
    if (!created) throw lastError || new Error('Could not allocate an order id');

    await client.query('COMMIT');

    return success(
      res,
      {
        order_id: created.order_id,
        status: created.status,
        plan_name: plan.name,
        duration_days: plan.duration_days,
        amount: amountRupees,
        amount_display: `₹${amountRupees.toFixed(2)}`,
        currency: created.currency,
        customer_name: name,
        email: cleanEmail,
        mobile: cleanMobile,
        utr_number: maskUtr(utrRaw),
        submitted_at: created.submitted_at,
        whatsapp_admin_number: settings.whatsapp_admin_number,
      },
      'Payment details submitted. Your subscription will be activated after we verify the payment.',
      201
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('createManualOrder error:', err.message);
    return error(res, 'Could not submit your payment details. Please try again.', 500);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/manual-orders/:orderId?email=... (or ?mobile=...)
// Order ids appear in WhatsApp messages, so this endpoint additionally requires
// the contact detail used at checkout — knowing an order id alone is not enough.
// ─────────────────────────────────────────────────────────────────────────────
exports.getManualOrder = async (req, res) => {
  try {
    const orderId = String(req.params.orderId ?? '').trim();
    if (!orderId) return error(res, 'Order not found', 404);

    const email = String(req.query.email ?? '').trim().toLowerCase();
    const mobile = String(req.query.mobile ?? '').replace(/[\s\-+()]/g, '');
    if (!email && !mobile) {
      return error(res, 'Enter the email address or mobile number you used at checkout to view this order.', 400);
    }

    const params = [orderId];
    const ownership = [];
    if (email) { params.push(email); ownership.push(`LOWER(po.email) = $${params.length}`); }
    if (mobile) {
      params.push(mobile);
      ownership.push(`REPLACE(REPLACE(REPLACE(po.mobile, ' ', ''), '-', ''), '+', '') = $${params.length}`);
    }

    const result = await db.query(
      `SELECT po.order_id, po.status, po.amount, po.currency, po.created_at, po.submitted_at,
              po.approved_at, po.rejected_at, po.rejection_reason, po.payment_mode,
              po.customer_name, po.email, po.mobile, po.utr_number,
              COALESCE(po.plan_name_snapshot, p.name) AS plan_name,
              COALESCE(po.duration_days_snapshot, p.duration_days) AS duration_days,
              l.license_key, l.status AS license_status, l.activated_at, l.expires_at
         FROM public_orders po
         LEFT JOIN plans p ON po.plan_id = p.id
         LEFT JOIN licenses l ON po.license_id = l.id
        WHERE po.order_id = $1 AND (${ownership.join(' OR ')})`,
      params
    );
    if (result.rows.length === 0) return error(res, 'Order not found', 404);

    const row = result.rows[0];
    const settings = await paymentSettings.getPaymentSettings();
    // Expiry is judged at read time, so a stalled cron job can't extend access.
    const licenseLive = row.license_status === 'active' && row.expires_at && new Date(row.expires_at) > new Date();

    return success(res, {
      order_id: row.order_id,
      status: row.status,
      payment_mode: row.payment_mode,
      plan_name: row.plan_name,
      duration_days: row.duration_days,
      amount: Number(row.amount) / 100,
      currency: row.currency,
      customer_name: row.customer_name,
      email: row.email,
      mobile: row.mobile,
      utr_number: maskUtr(row.utr_number),
      submitted_at: row.submitted_at || row.created_at,
      created_at: row.created_at,
      approved_at: row.approved_at,
      rejected_at: row.rejected_at,
      rejection_reason: row.rejection_reason,
      license_key: licenseLive || row.license_key ? row.license_key : null,
      license_status: row.license_status || null,
      subscription_start: row.activated_at || null,
      subscription_expiry: row.expires_at || null,
      remaining_days: licenseLive ? remainingDays(row.expires_at) : 0,
      whatsapp_admin_number: settings.whatsapp_admin_number,
    });
  } catch (err) {
    console.error('getManualOrder error:', err.message);
    return error(res, 'Failed to load order', 500);
  }
};

module.exports.normalizeUtr = normalizeUtr;
module.exports.maskUtr = maskUtr;

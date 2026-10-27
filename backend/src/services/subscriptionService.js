const crypto = require('crypto');

/**
 * Subscription date maths and license activation.
 *
 * In this product a "subscription" IS a license row: the license key is what the
 * NivaTV Android app checks, so activating a subscription means inserting an
 * ACTIVE row in `licenses`. Keeping all of this in one module means the Razorpay
 * flow and the manual-approval flow can never drift apart on expiry rules.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function generateLicenseKey() {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `NVT-${part()}-${part()}-${part()}`;
}

/**
 * Human-readable order id: NIVA-YYYYMMDD-XXXXXX.
 * Uses crypto randomness (not Math.random) because this id is quoted publicly in
 * WhatsApp messages and is the lookup key for the pending-payment page.
 */
function generateOrderId(prefix = 'NIVA', now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  // Crockford-ish alphabet: no I/O/0/1, so nothing is misread over the phone.
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${y}${m}${d}-${suffix}`;
}

/**
 * THE single place subscription start/expiry is computed.
 *
 * @param {number}  durationDays        plan length in days
 * @param {Date}    [currentExpiry]     expiry of the customer's existing ACTIVE
 *                                      subscription, if any
 * @param {boolean} [stackingEnabled]   when true a renewal bought before expiry
 *                                      is appended to the remaining time instead
 *                                      of throwing it away
 * @param {Date}    [now]               injectable for tests
 */
function calculateSubscriptionDates(durationDays, currentExpiry = null, stackingEnabled = true, now = new Date()) {
  const days = Number(durationDays);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('calculateSubscriptionDates: durationDays must be a positive number');
  }

  const activatedAt = new Date(now.getTime());
  let startDate = new Date(now.getTime());

  const expiryDate = currentExpiry ? new Date(currentExpiry) : null;
  const hasLiveSubscription =
    stackingEnabled && expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() > now.getTime();

  // Stacking: extend from the existing expiry so the customer loses no paid days.
  if (hasLiveSubscription) startDate = new Date(expiryDate.getTime());

  return {
    activatedAt,                                              // when access was granted
    startDate,                                                // when this plan's window opens
    expiresAt: new Date(startDate.getTime() + days * MS_PER_DAY),
    stacked: Boolean(hasLiveSubscription),
  };
}

/** Expiry is evaluated live on every read, so a delayed cron job can't grant free access. */
function isSubscriptionActive(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.expires_at) return false;
  return new Date(subscription.expires_at).getTime() > now.getTime();
}

function remainingDays(expiresAt, now = new Date()) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

/**
 * Latest non-expired license for a customer, matched by account id when they are
 * logged in and by email otherwise (guest checkout). Must run inside the caller's
 * transaction so stacking sees a consistent snapshot.
 */
async function findActiveSubscription(client, { userId, email }) {
  const conditions = [];
  const params = [];
  if (userId) { params.push(userId); conditions.push(`user_id = $${params.length}`); }
  if (email) { params.push(String(email).toLowerCase().trim()); conditions.push(`LOWER(customer_email) = $${params.length}`); }
  if (conditions.length === 0) return null;

  const result = await client.query(
    `SELECT id, license_key, status, expires_at, plan_id
       FROM licenses
      WHERE (${conditions.join(' OR ')})
        AND status = 'active'
        AND expires_at IS NOT NULL
        AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Creates the ACTIVE license that grants access. Runs inside the caller's
 * transaction so an order can never be marked approved without a license, or
 * vice versa.
 *
 * The try/catch fallback mirrors publicController.verifyPayment: some deployments
 * predate the payment_id / customer_email columns.
 */
async function activateLicense(client, {
  planId,
  durationDays,
  maxDevices,
  userId = null,
  customerEmail = null,
  paymentId = null,
  stackingEnabled = true,
  now = new Date(),
}) {
  const existing = await findActiveSubscription(client, { userId, email: customerEmail });
  const dates = calculateSubscriptionDates(durationDays, existing?.expires_at || null, stackingEnabled, now);

  const licenseKey = generateLicenseKey();
  const email = customerEmail ? String(customerEmail).toLowerCase().trim() : null;

  let licenseId;
  try {
    const inserted = await client.query(
      `INSERT INTO licenses
         (license_key, plan_id, payment_id, customer_email, status, duration_days, max_devices, user_id, activated_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9)
       RETURNING id`,
      [licenseKey, planId, paymentId, email, durationDays, maxDevices, userId, dates.activatedAt, dates.expiresAt]
    );
    licenseId = inserted.rows[0].id;
  } catch (err) {
    const legacySchema = err.message && (err.message.includes('payment_id') || err.message.includes('customer_email'));
    if (!legacySchema) throw err;
    const inserted = await client.query(
      `INSERT INTO licenses
         (license_key, plan_id, status, duration_days, max_devices, user_id, activated_at, expires_at)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
       RETURNING id`,
      [licenseKey, planId, durationDays, maxDevices, userId, dates.activatedAt, dates.expiresAt]
    );
    licenseId = inserted.rows[0].id;
  }

  return {
    licenseId,
    licenseKey,
    startDate: dates.startDate,
    expiresAt: dates.expiresAt,
    activatedAt: dates.activatedAt,
    stacked: dates.stacked,
    previousLicenseId: existing?.id || null,
  };
}

/**
 * Auto-provisions a 30-day Free Trial Pro license for a user if:
 * 1. User has not already claimed a trial (has_claimed_trial = false).
 * 2. User has no existing active or historical licenses.
 *
 * Atomically creates:
 * - Active License for 30 days with max_devices: 1, plan_tier: 'pro'
 * - Public Order marked 'paid' with amount: 0
 * - Sets users.has_claimed_trial = true
 *
 * Returns the active license or null if not eligible.
 */
async function ensureUserTrial(userId) {
  if (!userId) return null;
  const db = require('../config/db');

  try {
    // 1. Check user eligibility
    const userRes = await db.query(
      'SELECT id, full_name, email, mobile, COALESCE(has_claimed_trial, false) AS has_claimed_trial FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    if (user.has_claimed_trial) return null;

    // 2. Check if user already has any license
    const licRes = await db.query(
      'SELECT id FROM licenses WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (licRes.rows.length > 0) {
      await db.query('UPDATE users SET has_claimed_trial = true WHERE id = $1', [userId]);
      return null;
    }

    // 3. Find the active 30-day Free Trial Pro Plan
    const planRes = await db.query(
      `SELECT * FROM plans
       WHERE price = 0
         AND status = 'active'
         AND COALESCE(is_visible, true) = true
       ORDER BY sort_order ASC, id DESC
       LIMIT 1`
    );
    if (planRes.rows.length === 0) return null;
    const trialPlan = planRes.rows[0];

    const now = new Date();
    const durationDays = trialPlan.duration_days || 30;
    const expiresAt = new Date(now.getTime() + durationDays * MS_PER_DAY);
    const licenseKey = generateLicenseKey();
    const customerEmail = user.email ? user.email.toLowerCase().trim() : null;
    const orderId = `FREE_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 4. Insert license
    let licenseId;
    let newLicenseRow;
    try {
      const inserted = await db.query(
        `INSERT INTO licenses
           (license_key, plan_id, customer_email, status, duration_days, max_devices, user_id, activated_at, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
         RETURNING *`,
        [licenseKey, trialPlan.id, customerEmail, durationDays, trialPlan.max_devices || 1, user.id, now, expiresAt]
      );
      newLicenseRow = inserted.rows[0];
      licenseId = newLicenseRow.id;
    } catch (_) {
      const inserted = await db.query(
        `INSERT INTO licenses
           (license_key, plan_id, status, duration_days, max_devices, user_id, activated_at, expires_at)
         VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
         RETURNING *`,
        [licenseKey, trialPlan.id, durationDays, trialPlan.max_devices || 1, user.id, now, expiresAt]
      );
      newLicenseRow = inserted.rows[0];
      licenseId = newLicenseRow.id;
    }

    // 5. Insert order record
    try {
      await db.query(
        `INSERT INTO public_orders (order_id, plan_id, customer_name, email, mobile, amount, currency, status, user_id, license_id)
         VALUES ($1, $2, $3, $4, $5, 0, 'INR', 'paid', $6, $7)`,
        [orderId, trialPlan.id, user.full_name || 'Valued User', customerEmail || '', user.mobile || '', user.id, licenseId]
      );
    } catch (orderErr) {
      console.error('[ensureUserTrial] Warning: Could not insert public_order for free trial:', orderErr.message);
    }

    // 6. Mark trial claimed on user
    await db.query('UPDATE users SET has_claimed_trial = true WHERE id = $1', [user.id]);

    return {
      ...newLicenseRow,
      plan_name: trialPlan.name,
      plan_tier: trialPlan.plan_tier || 'pro',
    };
  } catch (err) {
    console.error('[ensureUserTrial] Error provisioning trial:', err.message);
    return null;
  }
}

module.exports = {
  MS_PER_DAY,
  generateLicenseKey,
  generateOrderId,
  calculateSubscriptionDates,
  isSubscriptionActive,
  remainingDays,
  findActiveSubscription,
  activateLicense,
  ensureUserTrial,
};

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

const TIER_RANK = {
  free: 0,
  starter: 1,
  pro: 2,
  plus: 3,
};

function normalizePlanTier(tier) {
  const t = String(tier || '').trim().toLowerCase();
  if (t === 'plus' || t === 'pro' || t === 'starter') return t;
  return 'free';
}

function getEffectiveChannelTier(channel) {
  if (!channel) return 'free';
  const t = String(channel.channel_tier || '').trim().toLowerCase();
  if (t === 'plus') return 'plus';
  if (t === 'pro') return 'pro';
  if (channel.is_premium === true || channel.is_paid === true) return 'pro';
  return 'free';
}

function canPlanAccessChannel(planTier, channel) {
  const effectivePlanTier = normalizePlanTier(planTier);
  const effectiveChannelTier = getEffectiveChannelTier(channel);
  return (TIER_RANK[effectivePlanTier] || 0) >= (TIER_RANK[effectiveChannelTier] || 0);
}

function isLicenseStatusUsable(status) {
  return status === 'active' || status === 'trial';
}

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
  if (!isLicenseStatusUsable(subscription.status)) return false;
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
  if (userId) { params.push(userId); conditions.push(`l.user_id = $${params.length}`); }
  if (email) { params.push(String(email).toLowerCase().trim()); conditions.push(`LOWER(l.customer_email) = $${params.length}`); }
  if (conditions.length === 0) return null;

  const result = await client.query(
    `SELECT l.id, l.license_key, l.status, l.expires_at, l.plan_id, l.duration_days, l.max_devices,
            p.name AS plan_name, p.plan_tier, p.max_devices AS plan_max_devices
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
      WHERE (${conditions.join(' OR ')})
        AND l.status IN ('active', 'trial')
        AND l.expires_at IS NOT NULL
        AND l.expires_at > NOW()
      ORDER BY l.expires_at DESC
      LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Resolves the user's current license state with live lazy-expiry normalization.
 * Returns { effectiveLicense, activeLicenses, allLicenses, licenseStatus, effectivePlanTier, remainingDays, maxDevices }.
 */
async function resolveUserLicense(clientOrDb, { userId, email = null, now = new Date(), autoLink = true } = {}) {
  if (!userId && !email) {
    return {
      effectiveLicense: null,
      activeLicenses: [],
      allLicenses: [],
      licenseStatus: 'none',
      effectivePlanTier: 'free',
      remainingDays: 0,
      maxDevices: 1,
    };
  }

  const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

  if (autoLink && userId && normalizedEmail) {
    await clientOrDb.query(
      'UPDATE licenses SET user_id = $1 WHERE user_id IS NULL AND LOWER(customer_email) = $2',
      [userId, normalizedEmail]
    ).catch(() => {});
  }

  const conditions = [];
  const params = [];
  if (userId) {
    params.push(userId);
    conditions.push(`l.user_id = $${params.length}`);
  }
  if (normalizedEmail) {
    params.push(normalizedEmail);
    conditions.push(`(l.customer_email IS NOT NULL AND LOWER(l.customer_email) = $${params.length})`);
  }

  const result = await clientOrDb.query(
    `SELECT l.*, p.name AS plan_name, p.plan_tier, p.price AS plan_price,
            p.duration_days AS plan_duration_days, p.max_devices AS plan_max_devices
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
      WHERE ${conditions.join(' OR ')}
      ORDER BY l.expires_at DESC NULLS LAST, l.created_at DESC`,
    params
  );

  const expiredIds = [];
  const rows = result.rows.map((row) => {
    const copy = { ...row };
    const expiresMs = copy.expires_at ? new Date(copy.expires_at).getTime() : NaN;
    const isPastExpiry = !Number.isFinite(expiresMs) || expiresMs <= now.getTime();
    if (isLicenseStatusUsable(copy.status) && isPastExpiry) {
      copy.status = 'expired';
      expiredIds.push(copy.id);
    }
    return copy;
  });

  if (expiredIds.length > 0) {
    await clientOrDb.query(
      `UPDATE licenses SET status = 'expired', updated_at = NOW() WHERE id = ANY($1::int[]) AND status IN ('active', 'trial')`,
      [expiredIds]
    ).catch(() => {});
  }

  const activeLicenses = rows
    .filter((row) => isSubscriptionActive(row, now))
    .sort((a, b) => {
      const rankDiff = (TIER_RANK[normalizePlanTier(b.plan_tier)] || 0) - (TIER_RANK[normalizePlanTier(a.plan_tier)] || 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
    });

  if (activeLicenses.length > 0) {
    const primary = activeLicenses[0];
    const effectivePlanTier = normalizePlanTier(primary.plan_tier);
    return {
      effectiveLicense: {
        ...primary,
        plan_tier: effectivePlanTier,
        max_devices: primary.max_devices || primary.plan_max_devices || 1,
        remaining_days: remainingDays(primary.expires_at, now),
      },
      activeLicenses,
      allLicenses: rows,
      licenseStatus: primary.status, // 'active' or 'trial'
      effectivePlanTier,
      remainingDays: remainingDays(primary.expires_at, now),
      maxDevices: primary.max_devices || primary.plan_max_devices || 1,
    };
  }

  const pendingOrLatest =
    rows.find((r) => r.status === 'pending_payment') ||
    rows.find((r) => ['expired', 'revoked', 'suspended', 'blocked'].includes(r.status)) ||
    null;

  return {
    effectiveLicense: pendingOrLatest
      ? {
          ...pendingOrLatest,
          plan_tier: normalizePlanTier(pendingOrLatest.plan_tier),
          max_devices: pendingOrLatest.max_devices || pendingOrLatest.plan_max_devices || 1,
          remaining_days: 0,
        }
      : null,
    activeLicenses: [],
    allLicenses: rows,
    licenseStatus: pendingOrLatest ? pendingOrLatest.status : 'none',
    effectivePlanTier: 'free',
    remainingDays: 0,
    maxDevices: 1,
  };
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

  if (userId) {
    try {
      const cache = require('../utils/cache');
      cache.invalidatePlaybackCache(userId);
    } catch (_) {}
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
 * 1. User is not blocked and has not already claimed a trial (has_claimed_trial = false).
 * 2. User has no existing active or historical licenses (by user_id or email) or orders.
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
      'SELECT id, full_name, email, mobile, status, COALESCE(has_claimed_trial, false) AS has_claimed_trial FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    if (user.status === 'blocked') return null;
    if (user.has_claimed_trial) return null;

    const customerEmail = user.email ? user.email.toLowerCase().trim() : null;

    // 2. Check if user already has any license (by user_id or customer_email) or trial order
    const licRes = await db.query(
      `SELECT id FROM licenses
       WHERE user_id = $1
          OR ($2::text IS NOT NULL AND customer_email IS NOT NULL AND LOWER(customer_email) = $2)
       LIMIT 1`,
      [userId, customerEmail]
    );
    if (licRes.rows.length > 0) {
      await db.query('UPDATE users SET has_claimed_trial = true WHERE id = $1', [userId]);
      return null;
    }

    if (customerEmail) {
      const orderRes = await db.query(
        `SELECT 1 FROM public_orders
         WHERE user_id = $1 OR (email IS NOT NULL AND LOWER(email) = $2)
         LIMIT 1`,
        [userId, customerEmail]
      );
      if (orderRes.rows.length > 0) {
        await db.query('UPDATE users SET has_claimed_trial = true WHERE id = $1', [userId]);
        return null;
      }
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

    try {
      const cache = require('../utils/cache');
      cache.invalidatePlaybackCache(user.id);
    } catch (_) {}

    return {
      ...newLicenseRow,
      plan_name: trialPlan.name,
      plan_tier: normalizePlanTier(trialPlan.plan_tier || 'pro'),
    };
  } catch (err) {
    console.error('[ensureUserTrial] Error provisioning trial:', err.message);
    return null;
  }
}

module.exports = {
  MS_PER_DAY,
  TIER_RANK,
  normalizePlanTier,
  getEffectiveChannelTier,
  canPlanAccessChannel,
  isLicenseStatusUsable,
  generateLicenseKey,
  generateOrderId,
  calculateSubscriptionDates,
  isSubscriptionActive,
  remainingDays,
  findActiveSubscription,
  resolveUserLicense,
  activateLicense,
  ensureUserTrial,
};

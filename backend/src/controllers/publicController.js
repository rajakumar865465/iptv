const crypto = require('crypto');
const db = require('../config/db');
const { success, error } = require('../utils/response');
const Razorpay = require('razorpay');

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function generateLicenseKey() {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `IPTV-${part()}-${part()}-${part()}`;
}

const formatChannelRow = (req, row) => {
  if (!row) return row;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  const localUrl = row.local_logo_url ? `${baseUrl}${row.local_logo_url}` : null;
  return {
    ...row,
    logo_url: localUrl || row.logo_url,
    local_logo_url: localUrl,
  };
};

// GET /api/public/plans
exports.getPlans = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, price, regular_price, duration_days, max_devices, description,
              sort_order, offer_label, is_popular, is_best_value
       FROM plans
       WHERE is_active = true AND is_visible = true AND COALESCE(status, 'active') != 'archived'
       ORDER BY sort_order ASC, id ASC`
    );
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch plans', 500);
  }
};

// GET /api/public/channels/popular
exports.getPopularChannels = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 20);
    // Try popular/featured first
    const result = await db.query(
      `SELECT c.id, c.name, c.logo_url, c.local_logo_url, c.language, c.is_premium, c.is_featured, c.is_popular,
              cat.name AS category
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.status = 'active' AND (c.is_popular = true OR c.is_featured = true)
       ORDER BY c.is_featured DESC, c.is_popular DESC, c.sort_order ASC
       LIMIT $1`,
      [limit]
    );
    // Fallback: return any active channels if none are flagged
    if (result.rows.length === 0) {
      const fallback = await db.query(
        `SELECT c.id, c.name, c.logo_url, c.local_logo_url, c.language, c.is_premium, c.is_featured, c.is_popular,
                cat.name AS category
         FROM channels c
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.status = 'active'
         ORDER BY c.sort_order ASC, c.id ASC
         LIMIT $1`,
        [limit]
      );
      return success(res, fallback.rows.map(r => formatChannelRow(req, r)));
    }
    return success(res, result.rows.map(r => formatChannelRow(req, r)));
  } catch (err) {
    return error(res, 'Failed to fetch popular channels', 500);
  }
};

// GET /api/public/channels/preview
exports.getChannelPreview = async (req, res) => {
  try {
    const categoryFilter = req.query.category;
    let sql =
      `SELECT c.id, c.name, c.logo_url, c.local_logo_url, c.language, c.is_premium, c.is_featured, c.is_popular,
              cat.name AS category
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.status = 'active'
         AND c.stream_url IS NOT NULL
         AND c.stream_url != ''`;
    const params = [];
    if (categoryFilter && categoryFilter !== '' && categoryFilter !== 'all') {
      // Robust match: trim + case-insensitive to handle data quality issues
      sql += ' AND TRIM(cat.name) ILIKE TRIM($1)';
      params.push(categoryFilter);
    }
    sql += ' ORDER BY c.sort_order ASC, c.name ASC';
    // For uncategorized / all view, return a preview using
    if (!categoryFilter || categoryFilter === '' || categoryFilter === 'all') {
      sql += ' LIMIT 50';
    }
    const result = await db.query(sql, params);
    return success(res, result.rows.map(r => formatChannelRow(req, r)));
  } catch (err) {
    return error(res, 'Failed to fetch channels', 500);
  }
};

// GET /api/public/categories
exports.getCategories = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cat.id, cat.name, cat.icon_url, cat.slug,
              COUNT(c.id) AS channel_count
       FROM categories cat
       LEFT JOIN channels c ON c.category_id = cat.id
         AND c.status = 'active'
         AND c.stream_url IS NOT NULL
         AND c.stream_url != ''
         AND c.merged_into_channel_id IS NULL
       WHERE cat.status = 'active'
         AND (cat.is_visible_public IS NULL OR cat.is_visible_public = true)
       GROUP BY cat.id
       HAVING COUNT(c.id) > 0
       ORDER BY cat.sort_order ASC, cat.name ASC`
    );
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch categories', 500);
  }
};

// GET /api/public/app/download
exports.getAppDownload = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT version, version_code, apk_url, file_size, release_notes, minimum_android_version, force_update, created_at
       FROM app_releases
       WHERE is_latest = true
       ORDER BY created_at DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return success(res, null, 'No release available');
    }
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch app release', 500);
  }
};

// GET /api/public/settings
const WEBSITE_KEYS = [
  'hero_title', 'hero_subtitle', 'support_whatsapp', 'support_email',
  'upi_id', 'payment_qr_url', 'telegram_url', 'apk_download_url',
  'stats_channels_count', 'stats_categories_count', 'stats_users_count',
  'app_name', 'support_phone',
];

exports.getSettings = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)`,
      [WEBSITE_KEYS]
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    return success(res, settings);
  } catch (err) {
    return error(res, 'Failed to fetch settings', 500);
  }
};

// POST /api/public/orders/create
exports.createOrder = async (req, res) => {
  try {
    const { plan_id, customer_name, email, mobile, offer_price } = req.body;

    if (!plan_id || !customer_name || !email || !mobile) {
      return error(res, 'plan_id, customer_name, email and mobile are required', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error(res, 'Invalid email address', 400);
    }
    const cleanMobile = mobile.replace(/[\s\-+]/g, '');
    if (!/^\d{9,15}$/.test(cleanMobile)) {
      return error(res, 'Invalid mobile number. Please enter a valid number.', 400);
    }

    const planResult = await db.query(
      `SELECT id, name, slug, price, duration_days, max_devices FROM plans WHERE id = $1 AND status = 'active'`,
      [plan_id]
    );
    if (planResult.rows.length === 0) {
      return error(res, 'Plan not found or inactive', 404);
    }
    const plan = planResult.rows[0];

    // Allow a scratch-card offer price for the 7-day offer plan (₹29–₹49, ending in 9)
    let finalPrice = Number(plan.price);
    if (offer_price !== undefined && plan.slug === 'seven-days-offer') {
      const op = Number(offer_price);
      const validOfferPrices = [29, 39, 49];
      if (!validOfferPrices.includes(op)) {
        return error(res, 'Invalid offer price', 400);
      }
      finalPrice = op;
    }

    let razorpay;
    try { razorpay = getRazorpay(); } catch (e) {
      return error(res, e.message, 503);
    }
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(finalPrice * 100),
      currency: 'INR',
      notes: { plan_id: String(plan.id), email, mobile, customer_name },
    });

    await db.query(
      `INSERT INTO public_orders (order_id, plan_id, customer_name, email, mobile, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'INR', 'created')`,
      [rzpOrder.id, plan.id, customer_name.trim(), email.toLowerCase().trim(), mobile.trim(), rzpOrder.amount]
    );

    return success(res, {
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      plan_name: plan.name,
      customer_name,
      email,
      mobile,
    }, 'Order created');
  } catch (err) {
    console.error('createOrder error:', err);
    return error(res, 'Failed to create order', 500);
  }
};

// POST /api/public/payments/verify
exports.verifyPayment = async (req, res) => {
  const client = await require('../config/db').pool.connect();
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return error(res, 'Missing payment verification fields', 400);
    }

    // Verify HMAC-SHA256 signature BEFORE touching the DB
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return error(res, 'Razorpay key secret not configured', 500);
    }
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return error(res, 'Payment verification failed: invalid signature', 400);
    }

    // Use a transaction + SELECT FOR UPDATE to prevent double-spend race condition
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT po.*, p.name AS plan_name, p.duration_days, p.max_devices
       FROM public_orders po
       JOIN plans p ON po.plan_id = p.id
       WHERE po.order_id = $1
       FOR UPDATE`,          // locks the row so concurrent requests queue up
      [razorpay_order_id]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'Order not found', 404);
    }
    const order = orderResult.rows[0];

    // Idempotency: already paid — return existing license
    if (order.status === 'paid' && order.license_id) {
      await client.query('ROLLBACK');
      const licResult = await db.query(
        `SELECT l.license_key, l.status, l.duration_days, l.max_devices, p.name AS plan_name
         FROM licenses l LEFT JOIN plans p ON l.plan_id = p.id WHERE l.id = $1`,
        [order.license_id]
      );
      return success(res, {
        license_key: licResult.rows[0]?.license_key,
        plan_name: order.plan_name,
        duration_days: order.duration_days,
        max_devices: order.max_devices,
        order_id: razorpay_order_id,
      }, 'Payment already verified');
    }

    // Generate license key
    const licenseKey = generateLicenseKey();

    // Insert payment record
    const paymentInsert = await client.query(
      `INSERT INTO payments (plan_id, amount, currency, payment_method, transaction_id, status,
        order_id, customer_name, mobile, gateway_order_id, gateway_signature, paid_at)
       VALUES ($1, $2, 'INR', 'razorpay', $3, 'completed', $4, $5, $6, $4, $7, NOW())
       RETURNING id`,
      [
        order.plan_id, order.amount, razorpay_payment_id, razorpay_order_id,
        order.customer_name, order.mobile, razorpay_signature,
      ]
    );
    const paymentId = paymentInsert.rows[0].id;

    // Insert license with customer email for admin visibility
    const customerEmail = order.email ? order.email.toLowerCase().trim() : null;
    let licenseId;
    try {
      const licenseInsert = await client.query(
        `INSERT INTO licenses (license_key, plan_id, payment_id, customer_email, status, duration_days, max_devices)
         VALUES ($1, $2, $3, $4, 'unused', $5, $6)
         RETURNING id`,
        [licenseKey, order.plan_id, paymentId, customerEmail, order.duration_days, order.max_devices]
      );
      licenseId = licenseInsert.rows[0].id;
    } catch (colErr) {
      // Fallback for older schema without payment_id/customer_email columns
      if (colErr.message && (colErr.message.includes('payment_id') || colErr.message.includes('customer_email'))) {
        const licenseInsert = await client.query(
          `INSERT INTO licenses (license_key, plan_id, status, duration_days, max_devices)
           VALUES ($1, $2, 'unused', $3, $4)
           RETURNING id`,
          [licenseKey, order.plan_id, order.duration_days, order.max_devices]
        );
        licenseId = licenseInsert.rows[0].id;
      } else {
        throw colErr;
      }
    }

    // Mark order paid
    await client.query(
      `UPDATE public_orders
       SET status = 'paid', gateway_payment_id = $1, gateway_signature = $2, license_id = $3, updated_at = NOW()
       WHERE order_id = $4`,
      [razorpay_payment_id, razorpay_signature, licenseId, razorpay_order_id]
    );

    await client.query('COMMIT');

    return success(res, {
      license_key: licenseKey,
      plan_name: order.plan_name,
      duration_days: order.duration_days,
      max_devices: order.max_devices,
      order_id: razorpay_order_id,
    }, 'Payment verified and license generated');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('verifyPayment error:', err.message);
    return error(res, 'Failed to verify payment', 500);
  } finally {
    client.release();
  }
};

// GET /api/public/payments/status/:orderId
exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await db.query(
      `SELECT po.order_id, po.status, po.plan_id, po.amount, po.currency, po.created_at,
              l.license_key, l.status AS license_status, l.duration_days, l.max_devices,
              p.name AS plan_name
       FROM public_orders po
       LEFT JOIN licenses l ON po.license_id = l.id
       LEFT JOIN plans p ON po.plan_id = p.id
       WHERE po.order_id = $1`,
      [orderId]
    );
    if (result.rows.length === 0) {
      return error(res, 'Order not found', 404);
    }
    const row = result.rows[0];
    return success(res, {
      order_id: row.order_id,
      status: row.status,
      plan_name: row.plan_name,
      amount: row.amount,
      currency: row.currency,
      license_key: row.license_key || null,
      license_status: row.license_status || null,
      duration_days: row.duration_days || null,
      max_devices: row.max_devices || null,
    });
  } catch (err) {
    return error(res, 'Failed to fetch order status', 500);
  }
};

// POST /api/public/license/check
exports.checkLicense = async (req, res) => {
  try {
    const { license_key } = req.body;
    if (!license_key) return error(res, 'license_key is required', 400);

    const result = await db.query(
      `SELECT l.license_key, l.status, l.duration_days, l.max_devices,
              l.activated_at, l.expires_at,
              p.name AS plan_name,
              COUNT(d.id) FILTER (WHERE d.status = 'active') AS devices_used
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       LEFT JOIN devices d ON d.license_id = l.id
       WHERE l.license_key = $1
       GROUP BY l.id, p.name`,
      [license_key.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return error(res, 'License key not found', 404);
    }

    const lic = result.rows[0];
    return success(res, {
      license_key: lic.license_key,
      status: lic.status,
      plan_name: lic.plan_name,
      duration_days: lic.duration_days,
      max_devices: lic.max_devices,
      devices_used: parseInt(lic.devices_used) || 0,
      activated_at: lic.activated_at,
      expires_at: lic.expires_at,
    });
  } catch (err) {
    return error(res, 'Failed to check license', 500);
  }
};

// GET /api/public/offers/7day — returns the hidden 7-day offer plan (id + metadata only)
exports.getSevenDayOffer = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, price, duration_days, max_devices
       FROM plans WHERE slug = 'seven-days-offer' AND status = 'active' LIMIT 1`
    );
    if (result.rows.length === 0) return error(res, 'Offer not available', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch offer', 500);
  }
};

// ── Admin controllers ────────────────────────────────────────────────────────

// GET /api/internal/app-releases
exports.getAppReleases = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM app_releases ORDER BY created_at DESC`
    );
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch releases', 500);
  }
};

// POST /api/internal/app-releases
exports.createAppRelease = async (req, res) => {
  try {
    const { version, version_code, apk_url, file_size, release_notes, minimum_android_version, is_latest, force_update } = req.body;
    if (!version || !version_code || !apk_url) {
      return error(res, 'version, version_code and apk_url are required', 400);
    }
    if (is_latest) {
      await db.query(`UPDATE app_releases SET is_latest = false`);
    }
    const result = await db.query(
      `INSERT INTO app_releases (version, version_code, apk_url, file_size, release_notes, minimum_android_version, is_latest, force_update)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [version, version_code, apk_url, file_size || null, JSON.stringify(release_notes || []), minimum_android_version || '7.0', !!is_latest, !!force_update]
    );
    return success(res, result.rows[0], 'Release created', 201);
  } catch (err) {
    return error(res, 'Failed to create release', 500);
  }
};

// PUT /api/internal/app-releases/:id
exports.updateAppRelease = async (req, res) => {
  try {
    const { id } = req.params;
    const { version, version_code, apk_url, file_size, release_notes, minimum_android_version, is_latest, force_update } = req.body;
    if (is_latest) {
      await db.query(`UPDATE app_releases SET is_latest = false WHERE id != $1`, [id]);
    }
    const result = await db.query(
      `UPDATE app_releases SET
        version = COALESCE($1, version),
        version_code = COALESCE($2, version_code),
        apk_url = COALESCE($3, apk_url),
        file_size = COALESCE($4, file_size),
        release_notes = COALESCE($5, release_notes),
        minimum_android_version = COALESCE($6, minimum_android_version),
        is_latest = COALESCE($7, is_latest),
        force_update = COALESCE($8, force_update)
       WHERE id = $9 RETURNING *`,
      [version, version_code, apk_url, file_size, release_notes ? JSON.stringify(release_notes) : null, minimum_android_version, is_latest, force_update, id]
    );
    if (result.rows.length === 0) return error(res, 'Release not found', 404);
    return success(res, result.rows[0], 'Release updated');
  } catch (err) {
    return error(res, 'Failed to update release', 500);
  }
};

// GET /api/internal/website-settings
exports.getWebsiteSettings = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)`,
      [WEBSITE_KEYS]
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    return success(res, settings);
  } catch (err) {
    return error(res, 'Failed to fetch website settings', 500);
  }
};

// PUT /api/internal/website-settings
exports.updateWebsiteSettings = async (req, res) => {
  try {
    const updates = req.body;
    const allowed = new Set(WEBSITE_KEYS);
    // Filter to only allowed keys
    const filteredEntries = Object.entries(updates).filter(([key]) => allowed.has(key));
    if (filteredEntries.length === 0) {
      return success(res, null, 'No valid settings to update');
    }
    const keys = filteredEntries.map(([k]) => k);
    const values = filteredEntries.map(([, v]) => String(v ?? ''));
    // Single atomic bulk upsert — avoids partial updates and multiple round-trips
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       SELECT t.key, t.value, NOW() FROM UNNEST($1::text[], $2::text[]) AS t(key, value)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [keys, values]
    );
    return success(res, null, 'Settings updated');
  } catch (err) {
    return error(res, 'Failed to update website settings', 500);
  }
};

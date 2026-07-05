const db = require('../config/db');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateAdminToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { generateLicenseKey } = require('../utils/helpers');

/**
 * Helper function to log admin actions to admin_audit_logs table
 * @param {Object} req - Express request object
 * @param {number} adminId - The admin's user ID
 * @param {string} action - The action performed (e.g., 'login', 'update_user_status')
 * @param {string} targetType - The type of resource (e.g., 'users', 'licenses', 'channels')
 * @param {string|number} targetId - The ID of the target resource
 * @param {Object} details - Additional details about the action (will be JSONB)
 */
const logAdminAction = async (req, adminId, action, targetType, targetId, details = {}) => {
  try {
    await db.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminId,
        action,
        targetType,
        targetId,
        JSON.stringify(details),
        req.ip || req.connection?.remoteAddress,
        req.get('User-Agent')
      ]
    );
  } catch (err) {
    // Log error should not break the main operation
    console.error('Failed to log admin action:', err.message);
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'admin']);
    if (result.rows.length === 0) {
      return error(res, 'Invalid admin credentials', 401);
    }

    const admin = result.rows[0];
    const isMatch = await comparePassword(password, admin.password_hash);
    if (!isMatch) {
      return error(res, 'Invalid admin credentials', 401);
    }

    // Log successful login
    await logAdminAction(req, admin.id, 'login', 'admin', admin.id, { email: admin.email });

    const token = generateAdminToken({ userId: admin.id, email: admin.email, role: 'admin' });
    success(res, { token, admin: { id: admin.id, full_name: admin.full_name, email: admin.email } });
  } catch (err) {
    error(res, 'Admin login failed', 500);
  }
};

// Users
exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query(
        'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    success(res, {
      data: result.rows,
      pagination: { page, limit, total, hasMore: offset + result.rows.length < total }
    });
  } catch (err) {
    error(res, 'Failed to fetch users', 500);
  }
};

exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return error(res, 'User not found', 404);
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch user', 500);
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const VALID_STATUSES = ['active', 'blocked', 'suspended'];
    if (!VALID_STATUSES.includes(status)) {
      return error(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    const result = await db.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, status',
      [status, id]
    );
    if (result.rows.length === 0) return error(res, 'User not found', 404);

    await logAdminAction(req, req.user.id, 'update_user_status', 'users', id, { status });

    success(res, result.rows[0], 'User status updated');
  } catch (err) {
    error(res, 'Failed to update user status', 500);
  }
};

// Licenses
exports.createLicense = async (req, res) => {
  try {
    const { plan_id, duration_days, max_devices } = req.body;
    const key = generateLicenseKey();
    const result = await db.query(
      'INSERT INTO licenses (license_key, plan_id, status, duration_days, max_devices) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [key, plan_id, 'unused', duration_days || 30, max_devices || 1]
    );

    await logAdminAction(req, req.user.id, 'create_license', 'licenses', result.rows[0].id, { plan_id, duration_days, max_devices });

    success(res, result.rows[0], 'License created', 201);
  } catch (err) {
    error(res, 'Failed to create license', 500);
  }
};

exports.getLicenses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      db.query('SELECT COUNT(*) FROM licenses'),
      db.query(
        `SELECT l.*, p.name as plan_name,
                COALESCE(u.email, l.customer_email) as user_email
         FROM licenses l
         LEFT JOIN plans p ON l.plan_id = p.id
         LEFT JOIN users u ON l.user_id = u.id
         ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    success(res, {
      data: result.rows,
      pagination: { page, limit, total, hasMore: offset + result.rows.length < total }
    });
  } catch (err) {
    error(res, 'Failed to fetch licenses', 500);
  }
};

exports.updateLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, user_id, expires_at } = req.body;

    // Validate user_id references a real user before re-assigning the license
    if (user_id !== null && user_id !== undefined) {
      if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1) {
        return error(res, 'user_id must be a positive integer', 400);
      }
      const userCheck = await db.query('SELECT 1 FROM users WHERE id = $1', [user_id]);
      if (userCheck.rows.length === 0) {
        return error(res, 'User not found for given user_id', 400);
      }
    }

    const result = await db.query(
      'UPDATE licenses SET status = $1, user_id = $2, expires_at = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [status, user_id, expires_at, id]
    );
    if (result.rows.length === 0) return error(res, 'License not found', 404);

    await logAdminAction(req, req.user.id, 'update_license', 'licenses', id, { status, user_id, expires_at });

    success(res, result.rows[0], 'License updated');
  } catch (err) {
    error(res, 'Failed to update license', 500);
  }
};

exports.extendLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.body.days);
    if (!days || days < 1 || days > 3650) {
      return error(res, 'days must be a positive integer between 1 and 3650', 400);
    }
    const result = await db.query(
      'UPDATE licenses SET expires_at = COALESCE(expires_at, NOW()) + interval \'1 day\' * $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [days, id]
    );
    if (result.rows.length === 0) return error(res, 'License not found', 404);

    await logAdminAction(req, req.user.id, 'extend_license', 'licenses', id, { days });

    success(res, result.rows[0], 'License extended');
  } catch (err) {
    error(res, 'Failed to extend license', 500);
  }
};

exports.suspendLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE licenses SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return error(res, 'License not found', 404);

    await logAdminAction(req, req.user.id, 'suspend_license', 'licenses', id);

    success(res, result.rows[0], 'License suspended');
  } catch (err) {
    error(res, 'Failed to suspend license', 500);
  }
};

exports.revokeLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE licenses SET status = 'revoked', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return error(res, 'License not found', 404);

    await logAdminAction(req, req.user.id, 'revoke_license', 'licenses', id);

    success(res, result.rows[0], 'License revoked');
  } catch (err) {
    error(res, 'Failed to revoke license', 500);
  }
};

// Channels
exports.createChannel = async (req, res) => {
  try {
    const { name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order, default_fit_mode, aspect_ratio_type, has_internal_black_bars, fit_note, player_display_status } = req.body;
    const result = await db.query(
      'INSERT INTO channels (name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order, default_fit_mode, aspect_ratio_type, has_internal_black_bars, fit_note, player_display_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *',
      [name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order, default_fit_mode, aspect_ratio_type, has_internal_black_bars, fit_note, player_display_status]
    );

    await logAdminAction(req, req.user.id, 'create_channel', 'channels', result.rows[0].id, { name, category_id, language });

    success(res, result.rows[0], 'Channel created', 201);
  } catch (err) {
    error(res, 'Failed to create channel', 500);
  }
};

exports.getChannelsAdmin = async (req, res) => {
  try {
    // BUG-12 FIX: Return pagination metadata so the admin UI can show totals and page controls.
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countResult, activeCountResult, dataResult] = await Promise.all([
      db.query('SELECT COUNT(*) FROM channels WHERE is_hidden = false AND is_removed = false'),
      db.query("SELECT COUNT(*) FROM channels WHERE status = 'active' AND is_hidden = false AND is_removed = false"),
      db.query('SELECT * FROM channels WHERE is_hidden = false AND is_removed = false ORDER BY sort_order ASC LIMIT $1 OFFSET $2', [limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const active = parseInt(activeCountResult.rows[0].count, 10);

    success(res, {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        active,
        hasMore: offset + dataResult.rows.length < total,
      },
    }, 'Success', 200);
  } catch (err) {
    error(res, 'Failed to fetch channels', 500);
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // Fix #18: Whitelist allowed column names to prevent SQL injection via field names
    const ALLOWED_FIELDS = [
      'name', 'logo_url', 'stream_url', 'backup_stream_url', 'category_id',
      'language', 'quality', 'status', 'is_featured', 'is_premium',
      'sort_order', 'user_agent', 'referrer', 'country', 'local_logo_url',
      'health_status', 'playback_mode', 'default_fit_mode', 'aspect_ratio_type',
      'has_internal_black_bars', 'fit_note', 'player_display_status'
    ];

    const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
    if (keys.length === 0) {
      return error(res, 'No valid fields to update', 400);
    }

    const values = keys.map(k => fields[k]);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const result = await db.query(
      `UPDATE channels SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) return error(res, 'Channel not found', 404);

    await logAdminAction(req, req.user.id, 'update_channel', 'channels', id, fields);

    success(res, result.rows[0], 'Channel updated');
  } catch (err) {
    error(res, 'Failed to update channel', 500);
  }
};

exports.deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM channels WHERE id = $1', [id]);
    if (result.rowCount === 0) return error(res, 'Channel not found', 404);

    await logAdminAction(req, req.user.id, 'delete_channel', 'channels', id);

    success(res, null, 'Channel deleted');
  } catch (err) {
    error(res, 'Failed to delete channel', 500);
  }
};

// Admin: Duplicate channel report
exports.getChannelDuplicates = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.canonical_name,
        COALESCE(c.language,'Unknown') AS language,
        cat.name                       AS category,
        COUNT(*)                       AS count,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',            c.id,
            'name',          c.name,
            'status',        c.status,
            'health_status', c.health_status,
            'quality',       c.quality,
            'source',        c.source,
            'stream_url',    LEFT(c.stream_url, 80)
          ) ORDER BY c.id
        ) AS channels
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status NOT IN ('merged','duplicate')
        AND c.canonical_name IS NOT NULL
        AND c.canonical_name != ''
      GROUP BY c.canonical_name, COALESCE(c.language,'Unknown'), cat.name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, c.canonical_name
      LIMIT 200
    `);
    success(res, {
      total_groups: rows.length,
      groups: rows,
    });
  } catch (err) {
    error(res, 'Failed to fetch duplicates', 500);
  }
};

// Categories
exports.createCategory = async (req, res) => {
  try {
    const { name, icon_url, sort_order } = req.body;
    const result = await db.query(
      'INSERT INTO categories (name, icon_url, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name, icon_url, sort_order]
    );

    await logAdminAction(req, req.user.id, 'create_category', 'categories', result.rows[0].id, { name, sort_order });

    success(res, result.rows[0], 'Category created', 201);
  } catch (err) {
    error(res, 'Failed to create category', 500);
  }
};

exports.getCategoriesAdmin = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY sort_order ASC');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch categories', 500);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon_url, status, sort_order } = req.body;
    const result = await db.query(
      'UPDATE categories SET name = $1, icon_url = $2, status = $3, sort_order = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, icon_url, status, sort_order, id]
    );
    if (result.rows.length === 0) return error(res, 'Category not found', 404);

    await logAdminAction(req, req.user.id, 'update_category', 'categories', id, { name, status, sort_order });

    success(res, result.rows[0], 'Category updated');
  } catch (err) {
    error(res, 'Failed to update category', 500);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    // Unlink channels from this category before deleting
    await db.query('UPDATE channels SET category_id = NULL WHERE category_id = $1', [id]);
    await db.query('DELETE FROM categories WHERE id = $1', [id]);

    await logAdminAction(req, req.user.id, 'delete_category', 'categories', id);

    success(res, null, 'Category deleted');
  } catch (err) {
    error(res, 'Failed to delete category', 500);
  }
};

// App Settings
exports.getAppSettings = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM app_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    success(res, settings);
  } catch (err) {
    error(res, 'Failed to fetch app settings', 500);
  }
};

exports.updateAppSettings = async (req, res) => {
  try {
    const ALLOWED_SETTINGS_KEYS = [
      'hero_title', 'hero_subtitle', 'support_whatsapp', 'support_email',
      'upi_id', 'payment_qr_url', 'telegram_url', 'apk_download_url',
      'stats_channels_count', 'stats_categories_count', 'stats_users_count',
      'app_name', 'support_phone', 'maintenance_mode', 'app_version_required',
    ];
    const updates = req.body;
    const filteredEntries = Object.entries(updates).filter(([k]) => ALLOWED_SETTINGS_KEYS.includes(k));
    const keys = filteredEntries.map(([k]) => k);
    const values = filteredEntries.map(([, v]) => String(v ?? ''));

    if (keys.length > 0) {
      await db.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at)
         SELECT t.key, t.value, NOW() FROM UNNEST($1::text[], $2::text[]) AS t(key, value)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
        [keys, values]
      );
    }

    await logAdminAction(req, req.user.id, 'update_settings', 'app_settings', null, { updated_keys: keys });

    success(res, null, 'Settings updated');
  } catch (err) {
    error(res, 'Failed to update settings', 500);
  }
};

// Payments
exports.getPayments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      db.query('SELECT COUNT(*) FROM payments'),
      db.query(
        `SELECT p.*, u.full_name, u.email, pl.name as plan_name FROM payments p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN plans pl ON p.plan_id = pl.id
         ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    success(res, {
      data: result.rows,
      pagination: { page, limit, total, hasMore: offset + result.rows.length < total }
    });
  } catch (err) {
    error(res, 'Failed to fetch payments', 500);
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const VALID_PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];
    if (!VALID_PAYMENT_STATUSES.includes(status)) {
      return error(res, `Invalid status. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`, 400);
    }
    const result = await db.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return error(res, 'Payment not found', 404);

    await logAdminAction(req, req.user.id, 'update_payment_status', 'payments', id, { status });

    success(res, result.rows[0], 'Payment status updated');
  } catch (err) {
    error(res, 'Failed to update payment status', 500);
  }
};

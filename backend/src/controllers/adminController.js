const db = require('../config/db');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateAdminToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { generateLicenseKey } = require('../utils/helpers');

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

    const token = generateAdminToken({ userId: admin.id, email: admin.email, role: 'admin' });
    success(res, { token, admin: { id: admin.id, full_name: admin.full_name, email: admin.email } });
  } catch (err) {
    error(res, 'Admin login failed', 500);
  }
};

// Users
exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at FROM users ORDER BY created_at DESC'
    );
    success(res, result.rows);
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
    const result = await db.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, status',
      [status, id]
    );
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
    success(res, result.rows[0], 'License created', 201);
  } catch (err) {
    error(res, 'Failed to create license', 500);
  }
};

exports.getLicenses = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, p.name as plan_name, u.email as user_email FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC`
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch licenses', 500);
  }
};

exports.updateLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, user_id, expires_at } = req.body;
    const result = await db.query(
      'UPDATE licenses SET status = $1, user_id = $2, expires_at = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [status, user_id, expires_at, id]
    );
    success(res, result.rows[0], 'License updated');
  } catch (err) {
    error(res, 'Failed to update license', 500);
  }
};

exports.extendLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;
    const result = await db.query(
      'UPDATE licenses SET expires_at = COALESCE(expires_at, NOW()) + interval \'1 day\' * $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [days, id]
    );
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
    success(res, result.rows[0], 'License revoked');
  } catch (err) {
    error(res, 'Failed to revoke license', 500);
  }
};

// Channels
exports.createChannel = async (req, res) => {
  try {
    const { name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order } = req.body;
    const result = await db.query(
      'INSERT INTO channels (name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status, is_featured, is_premium, sort_order]
    );
    success(res, result.rows[0], 'Channel created', 201);
  } catch (err) {
    error(res, 'Failed to create channel', 500);
  }
};

exports.getChannelsAdmin = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM channels ORDER BY sort_order ASC');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch channels', 500);
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const result = await db.query(`UPDATE channels SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
    success(res, result.rows[0], 'Channel updated');
  } catch (err) {
    error(res, 'Failed to update channel', 500);
  }
};

exports.deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM channels WHERE id = $1', [id]);
    success(res, null, 'Channel deleted');
  } catch (err) {
    error(res, 'Failed to delete channel', 500);
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
    success(res, result.rows[0], 'Category updated');
  } catch (err) {
    error(res, 'Failed to update category', 500);
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
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()',
        [key, value]
      );
    }
    success(res, null, 'Settings updated');
  } catch (err) {
    error(res, 'Failed to update settings', 500);
  }
};

// Payments
exports.getPayments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.full_name, u.email, pl.name as plan_name FROM payments p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN plans pl ON p.plan_id = pl.id
       ORDER BY p.created_at DESC`
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch payments', 500);
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await db.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    success(res, result.rows[0], 'Payment status updated');
  } catch (err) {
    error(res, 'Failed to update payment status', 500);
  }
};

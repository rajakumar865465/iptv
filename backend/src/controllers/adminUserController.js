const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { success, error } = require('../utils/response');

exports.getAdminUsers = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, full_name, email, mobile, admin_role, role, status, created_at, last_login_at FROM users WHERE role IN ('admin', 'superadmin') ORDER BY created_at DESC"
    );
    success(res, result.rows);
  } catch (err) {
    console.error('getAdminUsers error:', err.message);
    error(res, 'Failed to fetch admin users', 500);
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    const { full_name, email, mobile, password, admin_role } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password required', 400);
    }
    if (password.length < 8) {
      return error(res, 'Admin password must be at least 8 characters', 400);
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanMobile = mobile ? String(mobile).trim() : null;

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return error(res, 'An account with this email already exists', 409);
    }

    const allowedRoles = ['admin', 'moderator', 'support'];
    const safeRole = allowedRoles.includes(admin_role) ? admin_role : 'admin';

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      'INSERT INTO users (full_name, email, mobile, password_hash, role, admin_role, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, full_name, email, admin_role, status, created_at',
      [full_name ? String(full_name).trim() : 'Admin User', cleanEmail, cleanMobile, passwordHash, 'admin', safeRole, 'active']
    );

    success(res, result.rows[0], 'Admin created successfully', 201);
  } catch (err) {
    console.error('createAdminUser error:', err.message);
    error(res, 'Failed to create admin user', 500);
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, admin_role, status } = req.body;

    const allowedStatuses = ['active', 'blocked'];
    const safeStatus = allowedStatuses.includes(status) ? status : 'active';

    const allowedRoles = ['admin', 'moderator', 'support'];
    const safeRole = allowedRoles.includes(admin_role) ? admin_role : 'admin';

    const result = await db.query(
      'UPDATE users SET full_name = $1, admin_role = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING id, full_name, email, admin_role, status',
      [full_name ? String(full_name).trim() : 'Admin', safeRole, safeStatus, id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Admin user not found', 404);
    }

    success(res, result.rows[0], 'Admin updated successfully');
  } catch (err) {
    console.error('updateAdminUser error:', err.message);
    error(res, 'Failed to update admin user', 500);
  }
};

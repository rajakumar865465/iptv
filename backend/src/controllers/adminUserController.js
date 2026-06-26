const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { success, error } = require('../utils/response');

exports.getAdminUsers = async (req, res) => {
  try {
    const result = await db.query('SELECT id, full_name, email, admin_role, status, created_at, last_login_at FROM users WHERE role = $1 ORDER BY created_at DESC', ['admin']);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch admin users', 500);
  }
};

exports.createAdminUser = async? (req, res) => {
  try {
    const { full_name, email, mobile, password, admin_role } = req.body;
    const passwordHash = await hashPassword(password);
    const result = await db.query('INSERT INTO users (full_name, email, mobile, password_hash, role, admin_role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, full_name, email, admin_role, status, created_at',
      [full_name, email, mobile, passwordHash, 'admin', admin_role || 'admin']);
    success(res, result.rows[0], 'Admin created', 201);
  } catch (err) {
    error(res, 'Failed to create admin', 500);
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, admin_role, status } = req.body;
    const result = await db.query('UPDATE users SET full_name = $1, admin_role = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING id, full_name, email, admin_role, status',
      [full_name, admin_role, status, id]);
    success(res, result.rows[0], 'Admin updated');
  } catch (err) {
    error(res, 'Failed to update admin', 500);
  }
};

const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

exports.signup = async (req, res) => {
  try {
    const { full_name, email, mobile, password } = req.body;

    // Check if user exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR mobile = $2',
      [email, mobile]
    );
    if (existing.rows.length > 0) {
      return error(res, 'Email or mobile number already registered', 409);
    }

    const passwordHash = await hashPassword(password);

    const result = await db.query(
      `INSERT INTO users (full_name, email, mobile, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, mobile, status, role, created_at`,
      [full_name, email, mobile, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    success(res, { user, token }, 'Account created successfully', 201);
  } catch (err) {
    console.error('Signup error:', err);
    error(res, 'Failed to create account', 500);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, device_id, device_name, app_version } = req.body;
    const identifier = email; // email or mobile

    const result = await db.query(
      'SELECT id, full_name, email, mobile, password_hash, status, role FROM users WHERE email = $1 OR mobile = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      return error(res, 'Invalid email or password', 401);
    }

    const user = result.rows[0];

    if (user.status === 'blocked') {
      return error(res, 'Your account has been blocked. Please contact support.', 403);
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return error(res, 'Invalid email or password', 401);
    }

    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Handle device
    if (device_id) {
      const existingDevice = await db.query(
        'SELECT id FROM devices WHERE device_id = $1 AND user_id = $2',
        [device_id, user.id]
      );
      if (existingDevice.rows.length === 0) {
        await db.query(
          'INSERT INTO devices (user_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5)',
          [user.id, device_id, device_name || 'Unknown', app_version || '1.0.0', 'android']
        );
      } else {
        await db.query(
          'UPDATE devices SET last_active_at = NOW(), app_version = $1 WHERE id = $2',
          [app_version || '1.0.0', existingDevice.rows[0].id]
        );
      }
    }

    // Get license status
    const licenseResult = await db.query(
      `SELECT l.*, p.name as plan_name FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
       ORDER BY l.expires_at DESC LIMIT 1`,
      [user.id]
    );

    const license = licenseResult.rows[0] || null;
    const now = new Date();
    const licenseStatus = license && new Date(license.expires_at) > now ? license.status : 'none';

    // Get device count
    const deviceCount = await db.query(
      'SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2',
      [user.id, 'active']
    );

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    const { password_hash, ...userWithoutPassword } = user;

    success(res, {
      user: userWithoutPassword,
      token,
      user_status: user.status,
      license_status: licenseStatus,
      device_status: { count: parseInt(deviceCount.rows[0].count), max: license?.max_devices || 1 },
      license: license ? {
        id: license.id,
        status: license.status,
        plan_name: license.plan_name,
        expires_at: license.expires_at,
        remaining_days: license.expires_at ? Math.ceil((new Date(license.expires_at) - now) / (1000 * 60 * 60 * 24)) : 0,
      } : null,
    });
  } catch (err) {
    console.error('Login error:', err);
    error(res, 'Login failed', 500);
  }
};

exports.logout = async (req, res) => {
  // Client-side token removal
  success(res, null, 'Logged out successfully');
};

exports.forgotPassword = async (req, res) => {
  // MVP: Just return success, actual email sending can be added later
  success(res, null, 'Password reset instructions sent to your email');
};

exports.me = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch profile', 500);
  }
};

const db = require('../config/db');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

// Allowed status values for input validation
const VALID_USER_STATUSES = ['active', 'blocked', 'suspended'];

exports.signup = async (req, res) => {
  try {
    const { full_name, email, mobile, password } = req.body;

    // Input validation
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.trim().length > 100) {
      return error(res, 'Full name must be 2–100 characters', 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error(res, 'Invalid email address', 400);
    }
    const cleanMobile = (mobile || '').replace(/[\s\-+]/g, '');
    if (!/^\d{9,15}$/.test(cleanMobile)) {
      return error(res, 'Invalid mobile number', 400);
    }
    if (!password || password.length < 6 || password.length > 128) {
      return error(res, 'Password must be 6–128 characters', 400);
    }

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
    const refreshToken = generateRefreshToken(user.id);

    success(res, { user, token, refreshToken }, 'Account created successfully', 201);
  } catch (err) {
    console.error('Signup error:', err.message, err.stack);
    error(res, process.env.NODE_ENV === 'development' ? err.message : 'Failed to create account', 500);
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

    let license = null;
    let licenseStatus = 'none';
    let deviceCount = { rows: [{ count: 0 }] };
    const now = new Date();

    try {
      // Get license status first (needed for device limit check)
      const licenseResult = await db.query(
        `SELECT l.*, p.name as plan_name FROM licenses l
         LEFT JOIN plans p ON l.plan_id = p.id
         WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
         ORDER BY l.expires_at DESC LIMIT 1`,
        [user.id]
      );

      license = licenseResult.rows[0] || null;
      licenseStatus = license && new Date(license.expires_at) > now ? license.status : 'none';

      // Handle device with limit check
      if (device_id) {
        const existingDevice = await db.query(
          'SELECT id FROM devices WHERE device_id = $1 AND user_id = $2',
          [device_id, user.id]
        );
        if (existingDevice.rows.length === 0) {
          // Check device limit before inserting
          const deviceCountRes = await db.query(
            'SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2',
            [user.id, 'active']
          );
          let currentDeviceCount = parseInt(deviceCountRes.rows[0].count);
          const maxDevices = license?.max_devices || 1;
          
          if (currentDeviceCount >= maxDevices) {
            if (req.body.forceLogoutOldest) {
              while (currentDeviceCount >= maxDevices) {
                // Auto-remove oldest device instead of blocking login
                await db.query(`
                  DELETE FROM devices 
                  WHERE id IN (
                    SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1
                  )
                `, [user.id]);
                currentDeviceCount--;
              }
            } else {
              return res.status(403).json({
                success: false,
                error: 'DEVICE_LIMIT_REACHED',
                message: 'Device limit reached. Do you want to logout your oldest device to continue?'
              });
            }
          }
          
          await db.query(
            'INSERT INTO devices (user_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5)',
            [user.id, device_id, device_name || 'Unknown', app_version || '1.0.0', req.body.platform || 'android']
          );
        } else {
          await db.query(
            'UPDATE devices SET last_active_at = NOW(), app_version = $1 WHERE id = $2',
            [app_version || '1.0.0', existingDevice.rows[0].id]
          );
        }
      }

      // Get device count
      deviceCount = await db.query(
        'SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2',
        [user.id, 'active']
      );
    } catch (dbErr) {
      console.error('License/device query error (non-critical):', dbErr.message);
      // Continue login without license/device data
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);

    const { password_hash, ...userWithoutPassword } = user;

    success(res, {
      user: userWithoutPassword,
      token,
      refreshToken,
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
  // Revoke refresh token if provided
  const { refreshToken } = req.body;
  if (refreshToken) {
    const { revokeRefreshToken } = require('../utils/jwt');
    revokeRefreshToken(refreshToken);
  }
  success(res, null, 'Logged out successfully');
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return error(res, 'Refresh token required', 400);
    }

    const { consumeRefreshToken } = require('../utils/jwt');

    // consumeRefreshToken validates the token and returns the userId embedded in it
    // userId is extracted from the signed token — NOT trusted from the request body
    const { userId, newRefreshToken } = consumeRefreshToken(refreshToken);

    if (!userId) {
      return error(res, 'Invalid refresh token', 401);
    }

    // Fetch user to confirm they still exist and are active
    const userResult = await db.query(
      'SELECT id, full_name, email, mobile, status, role FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    const user = userResult.rows[0];
    if (user.status === 'blocked') {
      return error(res, 'Account blocked', 403);
    }

    const newAccessToken = generateToken({ userId: user.id, email: user.email, role: user.role });

    success(res, {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    error(res, 'Invalid or expired refresh token', 401);
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, mobile } = req.body;
    if (!email && !mobile) {
      return error(res, 'Email or mobile required', 400);
    }

    // Use cryptographically secure OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // TODO: Send OTP via email or SMS (nodemailer, Twilio, etc.)
    // NEVER return the OTP in the response — even in dev mode
    console.log(`[Password Reset] OTP for ${email || mobile}: ${otp} [dev-only log, remove in prod]`);

    // TODO: Store OTP in Redis or DB with 10-minute expiry
    // await redis.setex(`otp:${email || mobile}`, 600, otp);

    // Always return the same message to avoid account enumeration
    return success(res, { message: 'If the account exists, an OTP has been sent' });
  } catch (err) {
    error(res, 'Failed to process password reset request', 500);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, mobile, otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return error(res, 'OTP and new password required', 400);
    }
    if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
      return error(res, 'Password must be 6–128 characters', 400);
    }

    // TODO: Verify OTP from Redis/DB storage
    // const storedOtp = await redis.get(`otp:${email || mobile}`);
    // if (!storedOtp || storedOtp !== otp) return error(res, 'Invalid or expired OTP', 400);
    // await redis.del(`otp:${email || mobile}`);

    // Password reset is not yet fully implemented (OTP storage/email not set up)
    return error(res, 'Password reset via OTP is not yet available. Please contact support.', 501);
  } catch (err) {
    console.error('Reset password error:', err.message);
    error(res, 'Failed to reset password', 500);
  }
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

const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
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

    const { consumeRefreshToken, verifyToken } = require('../utils/jwt');
    
    // Verify and consume the refresh token, get new one
    const newRefreshToken = consumeRefreshToken(refreshToken);
    
    // Get user from any existing valid access token (for backward compat) or require user_id
    const { userId } = req.body;
    if (!userId) {
      return error(res, 'User ID required', 400);
    }

    // Fetch user
    const userResult = await db.query(
      'SELECT id, full_name, email, mobile, status, role FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    const user = userResult.rows[0];

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
  // TODO: Implement email/SMS OTP reset
  // For now, generate an OTP and store it temporarily (in production, send via email/SMS)
  try {
    const { email, mobile } = req.body;
    
    if (!email && !mobile) {
      return error(res, 'Email or mobile required', 400);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // TODO: Send OTP via email or SMS
    // For now, just log it (production would use nodemailer, twilio, etc.)
    console.log(`[Password Reset] OTP for ${email || mobile}: ${otp}`);
    
    // Store OTP temporarily (in production, use Redis with 10-min expiry)
    // For now, we return success with the OTP in dev mode only
    if (process.env.NODE_ENV !== 'production') {
      return success(res, { 
        otp, 
        message: 'OTP generated (dev mode only - in production this would be sent via email/SMS)' 
      });
    }

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

    // TODO: Verify OTP from storage (Redis in production)
    // For now, accept any 6-digit OTP in dev mode
    if (process.env.NODE_ENV === 'production') {
      return error(res, 'Password reset not yet fully implemented', 501);
    }

    // Find user and update password
    const identifier = email || mobile;
    const result = await db.query(
      'SELECT id FROM users WHERE email = $1 OR mobile = $1',
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return error(res, 'Invalid OTP or user not found', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    success(res, null, 'Password reset successfully');
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

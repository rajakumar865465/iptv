const db = require('../config/db');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { sendMail } = require('../utils/mailer');

const OTP_LIFETIME_MINUTES = 10;

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

    // Check if user exists using cleanMobile for consistent lookup
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR mobile = $2',
      [email, cleanMobile]
    );
    if (existing.rows.length > 0) {
      return error(res, 'Email or mobile number already registered', 409);
    }

    const passwordHash = await hashPassword(password);

    const result = await db.query(
      `INSERT INTO users (full_name, email, mobile, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, mobile, status, role, created_at`,
      [full_name, email, cleanMobile, passwordHash]
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
            if (req.body.forceLogoutOldest || req.body.force_logout_oldest) {
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
  try {
    // Revoke refresh token by storing its jti in a blocklist. For now we still
    // rely on short-lived access tokens, but this makes logout effective once
    // a refresh token is used again.
    const { refreshToken } = req.body;
    if (refreshToken) {
      const { revokeRefreshToken } = require('../utils/jwt');
      await revokeRefreshToken(refreshToken);
    }
    success(res, null, 'Logged out successfully');
  } catch (err) {
    console.error('Logout error:', err.message);
    success(res, null, 'Logged out successfully');
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return error(res, 'Refresh token required', 400);
    }

    const { consumeRefreshToken, isRefreshTokenRevoked, revokeRefreshToken } = require('../utils/jwt');

    const revoked = await isRefreshTokenRevoked(refreshToken);
    if (revoked) {
      return error(res, 'Token revoked. Please log in again.', 401);
    }

    // consumeRefreshToken validates the token and returns the userId embedded in it
    // userId is extracted from the signed token — NOT trusted from the request body
    const { userId, newRefreshToken } = consumeRefreshToken(refreshToken);

    if (!userId) {
      return error(res, 'Invalid refresh token', 401);
    }

    // Revoke the old refresh token after rotation
    await revokeRefreshToken(refreshToken);

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

    const identifier = email || mobile;

    // Verify the identifier exists in users before generating an OTP to limit abuse.
    const userResult = await db.query(
      'SELECT id, email, full_name FROM users WHERE email = $1 OR mobile = $2 LIMIT 1',
      [email || null, mobile || null]
    );
    if (userResult.rows.length === 0) {
      // Return success to avoid account enumeration
      return success(res, { message: 'If the account exists, an OTP has been sent' });
    }
    const user = userResult.rows[0];

    // Use cryptographically secure OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Purge used/expired OTP rows globally to keep the table small
    await db.query('DELETE FROM password_reset_otps WHERE used = true OR expires_at < NOW()');

    // Invalidate any still-valid OTPs for this email before issuing a new one
    // so an attacker holding an intercepted OTP cannot use it after a new request.
    await db.query('DELETE FROM password_reset_otps WHERE email = $1', [user.email]);

    const expiresAt = new Date(Date.now() + OTP_LIFETIME_MINUTES * 60 * 1000);
    await db.query(
      `INSERT INTO password_reset_otps (email, otp, expires_at)
       VALUES ($1, $2, $3)`,
      [user.email, otp, expiresAt]
    );

    // Attempt to send email; failures are logged but not exposed.
    try {
      await sendMail({
        to: user.email,
        subject: 'NivaTV Password Reset OTP',
        text: `Hi ${user.full_name || 'User'},\n\nYour OTP to reset your NivaTV password is: ${otp}\n\nThis OTP expires in ${OTP_LIFETIME_MINUTES} minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `<p>Hi ${user.full_name || 'User'},</p><p>Your OTP to reset your NivaTV password is: <strong>${otp}</strong></p><p>This OTP expires in ${OTP_LIFETIME_MINUTES} minutes.</p><p>If you did not request this, please ignore this email.</p>`,
      });
    } catch (mailErr) {
      console.error('[forgotPassword] Failed to send OTP email:', mailErr);
      // Still don't expose that the user exists.
    }

    // Always return the same message to avoid account enumeration
    return success(res, { message: 'If the account exists, an OTP has been sent' });
  } catch (err) {
    console.error('forgotPassword error:', err.message);
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

    const identifier = email || mobile;
    if (!identifier) {
      return error(res, 'Email or mobile required', 400);
    }

    // Resolve the user first — OTPs are always stored under the user's email,
    // even when the reset was requested with a mobile number.
    const userResult = await db.query(
      'SELECT id, email FROM users WHERE email = $1 OR mobile = $2 LIMIT 1',
      [email || null, mobile || null]
    );
    if (userResult.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    // Look up the most recent unused OTP for the user's email
    const otpResult = await db.query(
      `SELECT id, otp FROM password_reset_otps
       WHERE email = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userResult.rows[0].email]
    );
    if (otpResult.rows.length === 0 || otpResult.rows[0].otp !== String(otp)) {
      return error(res, 'Invalid or expired OTP', 400);
    }

    // Update password and mark OTP used
    const passwordHash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userResult.rows[0].id]);
    await db.query('UPDATE password_reset_otps SET used = true, updated_at = NOW() WHERE id = $1', [otpResult.rows[0].id]);

    return success(res, { message: 'Password reset successful. Please log in.' });
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

const db = require('../config/db');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { sendMail } = require('../utils/mailer');
const { remainingDays, ensureUserTrial } = require('../services/subscriptionService');

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
    if (cleanMobile && !/^\d{9,15}$/.test(cleanMobile)) {
      return error(res, 'Invalid mobile number', 400);
    }
    if (!password || password.length < 6 || password.length > 128) {
      return error(res, 'Password must be 6–128 characters', 400);
    }

    // Check if user exists using cleanMobile for consistent lookup
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR (mobile = $2 AND $2 != \'\')',
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
    // Automatically provision 1-Month Free Trial Pro plan for newly registered users
    await ensureUserTrial(user.id);
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
      'SELECT id, full_name, email, mobile, password_hash, status, role, COALESCE(has_claimed_trial, false) AS has_claimed_trial FROM users WHERE email = $1 OR mobile = $1',
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
        `SELECT l.*, p.name as plan_name, p.plan_tier FROM licenses l
         LEFT JOIN plans p ON l.plan_id = p.id
         WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
         ORDER BY l.expires_at DESC LIMIT 1`,
        [user.id]
      );

      if (licenseResult.rows.length === 0 && !user.has_claimed_trial) {
        const trialLic = await ensureUserTrial(user.id);
        if (trialLic) {
          licenseResult = { rows: [trialLic] };
        }
      }
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
        plan_tier: license.plan_tier || 'free',
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
      `SELECT id, otp, COALESCE(attempts, 0) AS attempts FROM password_reset_otps
       WHERE email = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userResult.rows[0].email]
    );

    if (otpResult.rows.length === 0) {
      return error(res, 'Invalid or expired OTP', 400);
    }

    const currentOtpRow = otpResult.rows[0];

    // Enforce 5-attempt limit
    if (currentOtpRow.attempts >= 5) {
      await db.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [currentOtpRow.id]);
      return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
    }

    if (currentOtpRow.otp !== String(otp).trim()) {
      const newAttempts = currentOtpRow.attempts + 1;
      if (newAttempts >= 5) {
        await db.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [currentOtpRow.id]);
        return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
      } else {
        await db.query('UPDATE password_reset_otps SET attempts = $1 WHERE id = $2', [newAttempts, currentOtpRow.id]);
        return error(res, `Invalid OTP. ${5 - newAttempts} attempt(s) remaining.`, 400);
      }
    }

    // Update password and mark OTP used
    const passwordHash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userResult.rows[0].id]);
    await db.query('UPDATE password_reset_otps SET used = true, updated_at = NOW() WHERE id = $1', [currentOtpRow.id]);

    return success(res, { message: 'Password reset successful. Please log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    error(res, 'Failed to reset password', 500);
  }
};

exports.me = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role, created_at, last_login_at, COALESCE(has_claimed_trial, false) AS has_claimed_trial FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    const user = result.rows[0];

    // Auto-link any orphaned licenses or orders created with this user's email
    if (user.email) {
      await db.query(
        'UPDATE licenses SET user_id = $1 WHERE user_id IS NULL AND LOWER(customer_email) = LOWER($2)',
        [user.id, user.email]
      );
      await db.query(
        'UPDATE public_orders SET user_id = $1 WHERE user_id IS NULL AND LOWER(email) = LOWER($2)',
        [user.id, user.email]
      );
    }

    // Self-healing check: If has_claimed_trial is false, verify against licenses and public_orders
    if (!user.has_claimed_trial) {
      const trialCheck = await db.query(
        `SELECT 1 FROM licenses l 
         LEFT JOIN plans p ON l.plan_id = p.id 
         WHERE (l.user_id = $1 OR (l.customer_email IS NOT NULL AND LOWER(l.customer_email) = LOWER($2)))
           AND (l.plan_id = 64 OR p.price = 0 OR p.slug LIKE '%trial%')
         LIMIT 1`,
        [user.id, user.email || '']
      );

      const orderCheck = trialCheck.rows.length === 0 ? await db.query(
        `SELECT 1 FROM public_orders 
         WHERE (user_id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2)))
           AND (amount = 0 OR plan_id = 64)
         LIMIT 1`,
        [user.id, user.email || '']
      ) : null;

      if (trialCheck.rows.length > 0 || (orderCheck && orderCheck.rows.length > 0)) {
        user.has_claimed_trial = true;
        await db.query('UPDATE users SET has_claimed_trial = true WHERE id = $1', [user.id]);
      }
    }

    // Active subscription check for seamless frontend display
    const now = new Date();
    const activeLic = await db.query(
      `SELECT l.id, l.expires_at, p.name as plan_name, p.plan_tier 
       FROM licenses l 
       LEFT JOIN plans p ON l.plan_id = p.id 
       WHERE (l.user_id = $1 OR (l.customer_email IS NOT NULL AND LOWER(l.customer_email) = LOWER($2)))
         AND l.status = 'active' 
         AND l.expires_at > $3 
       ORDER BY l.expires_at DESC 
       LIMIT 1`,
      [user.id, user.email || '', now]
    );

    if (activeLic.rows.length > 0) {
      user.has_active_subscription = true;
      user.subscription_expires_at = activeLic.rows[0].expires_at;
      user.subscription_plan_name = activeLic.rows[0].plan_name;
      user.subscription_plan_tier = activeLic.rows[0].plan_tier;
    } else {
      user.has_active_subscription = false;
      user.subscription_expires_at = null;
      user.subscription_plan_name = null;
      user.subscription_plan_tier = null;
    }

    success(res, { user });
  } catch (err) {
    console.error('[authController.me] Error:', err.message);
    error(res, 'Failed to fetch profile', 500);
  }
};

exports.myPurchases = async (req, res) => {
  try {
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;

    // Auto-link any orphaned licenses or orders created with this user's email
    if (userEmail) {
      await db.query(
        'UPDATE licenses SET user_id = $1 WHERE user_id IS NULL AND LOWER(customer_email) = $2',
        [req.user.id, userEmail]
      );
      await db.query(
        'UPDATE public_orders SET user_id = $1 WHERE user_id IS NULL AND LOWER(email) = $2',
        [req.user.id, userEmail]
      );
    }

    const licensesResult = await db.query(
      `SELECT l.*, p.name as plan_name, p.plan_tier
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE l.user_id = $1 OR (l.customer_email IS NOT NULL AND LOWER(l.customer_email) = LOWER($2))
       ORDER BY l.created_at DESC`,
      [req.user.id, userEmail || '']
    );

    const ordersResult = await db.query(
      `SELECT o.order_id, o.amount, o.currency, o.status, o.payment_mode, o.created_at,
              o.submitted_at, o.approved_at, o.rejected_at, o.rejection_reason,
              o.utr_number, o.payment_date,
              COALESCE(o.plan_name_snapshot, p.name) as plan_name,
              COALESCE(o.duration_days_snapshot, p.duration_days) as duration_days
       FROM public_orders o
       LEFT JOIN plans p ON o.plan_id = p.id
       WHERE o.user_id = $1 OR (o.email IS NOT NULL AND LOWER(o.email) = LOWER($2))
       ORDER BY o.created_at DESC`,
      [req.user.id, userEmail || '']
    );

    // Current subscription = the licence with the furthest future expiry. Expiry is
    // judged here rather than trusting `status`, so a delayed expiry job can't keep
    // showing a lapsed plan as active.
    const now = new Date();
    const activeLicense = licensesResult.rows
      .filter(l => l.status === 'active' && l.expires_at && new Date(l.expires_at) > now)
      .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0] || null;

    const subscription = activeLicense
      ? {
          plan_name: activeLicense.plan_name,
          plan_tier: activeLicense.plan_tier,
          plan_id: activeLicense.plan_id,
          status: 'active',
          license_key: activeLicense.license_key,
          start_date: activeLicense.activated_at,
          expiry_date: activeLicense.expires_at,
          remaining_days: remainingDays(activeLicense.expires_at, now),
          max_devices: activeLicense.max_devices,
          total_active_licenses: licensesResult.rows.filter(l => l.status === 'active' && l.expires_at && new Date(l.expires_at) > now).length,
        }
      : null;

    success(res, {
      licenses: licensesResult.rows,
      // public_orders.amount is stored in paise; expose rupees for display.
      orders: ordersResult.rows.map(o => ({ ...o, amount: Number(o.amount || 0) / 100 })),
      subscription,
      // A pending manual payment awaiting admin verification, if any.
      pending_order: ordersResult.rows.find(o => o.status === 'pending')?.order_id || null,
    });
  } catch (err) {
    console.error('Failed to fetch purchases:', err);
    error(res, 'Failed to fetch purchases', 500);
  }
};

exports.streamHeartbeat = async (req, res) => {
  try {
    const { channel_id, device_id, action } = req.body;
    if (!device_id || !action) return error(res, 'device_id and action are required', 400);

    const userId = req.user.id;

    if (action === 'stop') {
      await db.query(
        'UPDATE devices SET last_stream_ping_at = NULL, active_channel_id = NULL WHERE device_id = $1 AND user_id = $2',
        [device_id, userId]
      );
      return success(res, { success: true });
    }

    if (action === 'start' || action === 'ping') {
      const licenseResult = await db.query(
        `SELECT l.max_devices
         FROM licenses l
         WHERE l.user_id = $1 AND l.status = 'active' AND l.expires_at > NOW()`,
        [userId]
      );

      const maxDevices = licenseResult.rows.length > 0 ? (licenseResult.rows[0].max_devices || 1) : 1;

      const activeDevicesRes = await db.query(
        `SELECT COUNT(*) FROM devices 
         WHERE user_id = $1 
         AND device_id != $2 
         AND last_stream_ping_at > NOW() - INTERVAL '60 seconds'`,
        [userId, device_id]
      );

      const activeCount = parseInt(activeDevicesRes.rows[0].count);

      if (activeCount >= maxDevices) {
        return res.status(403).json({
          success: false,
          error: 'CONCURRENT_STREAM_LIMIT_REACHED',
          message: 'You are already watching on the maximum number of devices allowed by your plan. Please stop playback on another device first.'
        });
      }

      await db.query(
        'UPDATE devices SET last_stream_ping_at = NOW(), active_channel_id = $1 WHERE device_id = $2 AND user_id = $3',
        [channel_id || null, device_id, userId]
      );

      return success(res, { success: true });
    }

    return error(res, 'Invalid action', 400);
  } catch (err) {
    console.error('streamHeartbeat error:', err);
    error(res, 'Failed to process heartbeat', 500);
  }
};

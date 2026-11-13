const db = require('../config/db');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { ensureUserTrial, resolveUserLicense } = require('../services/subscriptionService');

// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\d{9,15}$/.test(mobile.replace(/[\s\-+]/g, ''))) {
      return error(res, 'Valid mobile number is required', 400);
    }
    
    const cleanMobile = mobile.replace(/[\s\-+]/g, '');
    const code = generateOTP();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // Save OTP to database
    await db.query(
      `INSERT INTO otp_codes (mobile, code, expires_at) VALUES ($1, $2, $3)`,
      [cleanMobile, code, expiresAt]
    );

    // TODO: Integrate your SMS Provider here (Twilio, MSG91, Fast2SMS, etc.)
    // Example: await twilioClient.messages.create({ body: \`Your NivaTV code is \${code}\`, to: \`+\${cleanMobile}\` });
    console.log(`[DEVELOPMENT ONLY] OTP for ${cleanMobile} is ${code}`);

    return success(res, null, 'OTP sent successfully');
  } catch (err) {
    console.error('Send OTP error:', err);
    return error(res, 'Failed to send OTP', 500);
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, code } = req.body;
    if (!mobile || !code) {
      return error(res, 'Mobile and code are required', 400);
    }

    const cleanMobile = mobile.replace(/[\s\-+]/g, '');

    // Look up active OTP for this mobile to check attempts counter
    const otpRes = await db.query(
      `SELECT id, code, COALESCE(attempts, 0) AS attempts FROM otp_codes
       WHERE mobile = $1 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [cleanMobile]
    );

    if (otpRes.rows.length === 0) {
      return error(res, 'Invalid or expired OTP', 400);
    }

    const currentOtp = otpRes.rows[0];

    // Lockout if 5 failed attempts exceeded
    if (currentOtp.attempts >= 5) {
      await db.query('DELETE FROM otp_codes WHERE mobile = $1', [cleanMobile]);
      return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
    }

    // Verify OTP code
    if (currentOtp.code !== String(code).trim()) {
      const newAttempts = currentOtp.attempts + 1;
      if (newAttempts >= 5) {
        await db.query('DELETE FROM otp_codes WHERE mobile = $1', [cleanMobile]);
        return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
      } else {
        await db.query('UPDATE otp_codes SET attempts = $1 WHERE id = $2', [newAttempts, currentOtp.id]);
        return error(res, `Invalid OTP. ${5 - newAttempts} attempt(s) remaining.`, 400);
      }
    }

    // Atomically consume the OTP and clean up
    await db.query(`DELETE FROM otp_codes WHERE mobile = $1`, [cleanMobile]);

    // Check if user exists
    let userResult = await db.query('SELECT * FROM users WHERE mobile = $1', [cleanMobile]);
    let user = userResult.rows[0];

    // If no user, create one
    if (!user) {
      const insertResult = await db.query(
        `INSERT INTO users (full_name, mobile, status, role)
         VALUES ($1, $2, 'active', 'user') RETURNING *`,
        ['User', cleanMobile]
      );
      user = insertResult.rows[0];
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: 'USER_BLOCKED',
        error_code: 'USER_BLOCKED',
        message: 'Your account has been blocked. Please contact support.',
      });
    }
    if (user.status !== 'active') {
      return error(res, 'User account is not active', 403);
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const now = new Date();
    let resolved = {
      effectiveLicense: null,
      activeLicenses: [],
      licenseStatus: 'none',
      effectivePlanTier: 'free',
      remainingDays: 0,
      maxDevices: 1,
    };
    let deviceCount = { rows: [{ count: 0 }] };
    const { device_id, device_name, app_version, forceLogoutOldest, force_logout_oldest } = req.body;

    try {
      resolved = await resolveUserLicense(db, {
        userId: user.id,
        email: user.email || null,
        now,
        autoLink: true,
      });
      const maxDevices = resolved.maxDevices || 1;

      if (device_id) {
        const existingDevice = await db.query('SELECT id FROM devices WHERE device_id = $1 AND user_id = $2', [device_id, user.id]);
        if (existingDevice.rows.length === 0) {
          const deviceCountRes = await db.query('SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2', [user.id, 'active']);
          let currentDeviceCount = parseInt(deviceCountRes.rows[0].count, 10);
          if (currentDeviceCount >= maxDevices) {
            if (forceLogoutOldest || force_logout_oldest) {
              while (currentDeviceCount >= maxDevices) {
                await db.query(
                  `DELETE FROM devices WHERE id IN (SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1)`,
                  [user.id]
                );
                currentDeviceCount--;
              }
            } else {
              return res.status(403).json({
                success: false,
                error: 'DEVICE_LIMIT_REACHED',
                error_code: 'DEVICE_LIMIT_REACHED',
                message: 'Device limit reached. Do you want to logout your oldest device to continue?',
              });
            }
          }
          await db.query(
            'INSERT INTO devices (user_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5)',
            [user.id, device_id, device_name || 'Unknown', app_version || '1.0.0', req.body.platform || 'android']
          );
        } else {
          await db.query('UPDATE devices SET last_active_at = NOW(), app_version = $1 WHERE id = $2', [app_version || '1.0.0', existingDevice.rows[0].id]);
        }
      }
      deviceCount = await db.query('SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2', [user.id, 'active']);
    } catch (dbErr) {
      console.error('OTP license/device query error:', dbErr.message);
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);
    const lic = resolved.effectiveLicense;

    return success(res, {
      token,
      refreshToken,
      user_status: user.status,
      license_status: resolved.licenseStatus,
      device_status: { count: parseInt(deviceCount.rows[0].count, 10), max: resolved.maxDevices || 1 },
      license: lic ? {
        id: lic.id,
        license_key: lic.license_key,
        status: lic.status,
        plan_name: lic.plan_name,
        plan_tier: resolved.effectivePlanTier,
        expires_at: lic.expires_at,
        remaining_days: resolved.remainingDays,
        max_devices: resolved.maxDevices || 1,
      } : null,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role
      }
    }, 'Login successful');
  } catch (err) {
    console.error('Verify OTP error:', err);
    return error(res, 'OTP verification failed', 500);
  }
};

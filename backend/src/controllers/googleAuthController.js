const db = require('../config/db');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { ensureUserTrial, resolveUserLicense } = require('../services/subscriptionService');
const { OAuth2Client } = require('google-auth-library');
const DEFAULT_GOOGLE_CLIENT_ID = '73771138100-in6cnnidmh4hd3ltcubls6glq4a3k0rj.apps.googleusercontent.com';
const googleClientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

exports.googleLogin = async (req, res) => {
  try {
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
      return error(res, 'Google credential or access token is required', 400);
    }

    let googleId, email, name;

    if (credential) {
      const activeClientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
      const audiences = [
        activeClientId,
        DEFAULT_GOOGLE_CLIENT_ID,
        '73771138100-u2lfb2qm2dcqsqpjvq3brqlfvqvdqmp9.apps.googleusercontent.com',
        '73771138100-tkp8rhpqfdfupq7be13hoh7kaui2em5l.apps.googleusercontent.com',
      ];
      const uniqueAudiences = [...new Set(audiences.filter(Boolean))];

      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: uniqueAudiences,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
    } else if (access_token) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (!userRes.ok) {
        return error(res, 'Invalid Google access token', 400);
      }
      const userData = await userRes.json();
      googleId = userData.sub;
      email = userData.email;
      name = userData.name;
    }

    if (!googleId || !email) {
      return error(res, 'Invalid Google token payload', 400);
    }

    // 1. Check if user already exists by google_id
    let userResult = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = userResult.rows[0];

    // 2. If not, check if user exists by email and link them
    if (!user) {
      let emailResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (emailResult.rows.length > 0) {
        user = emailResult.rows[0];
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
      }
    }

    // 3. If still no user, create a new one
    if (!user) {
      const insertResult = await db.query(
        `INSERT INTO users (full_name, email, google_id, status, role)
         VALUES ($1, $2, $3, 'active', 'user') RETURNING *`,
        [name || 'Google User', email, googleId]
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

    let resolved = {
      effectiveLicense: null,
      activeLicenses: [],
      licenseStatus: 'none',
      effectivePlanTier: 'free',
      remainingDays: 0,
      maxDevices: 1,
    };
    let deviceCount = { rows: [{ count: 0 }] };
    const now = new Date();

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
          let currentDeviceCount = parseInt(deviceCountRes.rows[0].count);

          if (currentDeviceCount >= maxDevices) {
            if (forceLogoutOldest || force_logout_oldest) {
              while (currentDeviceCount >= maxDevices) {
                await db.query(`DELETE FROM devices WHERE id IN (SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1)`, [user.id]);
                currentDeviceCount--;
              }
            } else {
              return res.status(403).json({
                success: false,
                error: 'DEVICE_LIMIT_REACHED',
                error_code: 'DEVICE_LIMIT_REACHED',
                message: 'Device limit reached. Do you want to logout your oldest device to continue?'
              });
            }
          }
          await db.query('INSERT INTO devices (user_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5)', [user.id, device_id, device_name || 'Unknown', app_version || '1.0.0', req.body.platform || 'android']);
        } else {
          await db.query('UPDATE devices SET last_active_at = NOW(), app_version = $1 WHERE id = $2', [app_version || '1.0.0', existingDevice.rows[0].id]);
        }
      }
      deviceCount = await db.query('SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2', [user.id, 'active']);
    } catch (dbErr) {
      console.error('License/device query error:', dbErr.message);
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);
    const lic = resolved.effectiveLicense;

    return success(res, {
      token,
      refreshToken,
      user_status: user.status,
      license_status: resolved.licenseStatus,
      device_status: { count: parseInt(deviceCount.rows[0].count), max: resolved.maxDevices || 1 },
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
    console.error('Google login error:', err.message, err.stack);
    return error(res, 'Google authentication failed. Please try again.', 401);
  }
};

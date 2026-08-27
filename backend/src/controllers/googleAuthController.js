const db = require('../config/db');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
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
      const audiences = [activeClientId];
      if (!audiences.includes(DEFAULT_GOOGLE_CLIENT_ID)) {
        audiences.push(DEFAULT_GOOGLE_CLIENT_ID);
      }
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: audiences,
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

    if (user.status !== 'active') {
      return error(res, 'User account is not active', 403);
    }

    
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    
    let license = null;
    let licenseStatus = 'none';
    let deviceCount = { rows: [{ count: 0 }] };
    const now = new Date();
    
    const { device_id, device_name, app_version, forceLogoutOldest, force_logout_oldest } = req.body;
    
    try {
      const licenseResult = await db.query(
        `SELECT l.*, p.name as plan_name, p.plan_tier FROM licenses l
         LEFT JOIN plans p ON l.plan_id = p.id
         WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
         ORDER BY l.expires_at DESC LIMIT 1`,
        [user.id]
      );
      license = licenseResult.rows[0] || null;
      licenseStatus = license && new Date(license.expires_at) > now ? license.status : 'none';

      if (device_id) {
        const existingDevice = await db.query('SELECT id FROM devices WHERE device_id = $1 AND user_id = $2', [device_id, user.id]);
        if (existingDevice.rows.length === 0) {
          const deviceCountRes = await db.query('SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2', [user.id, 'active']);
          let currentDeviceCount = parseInt(deviceCountRes.rows[0].count);
          const maxDevices = license?.max_devices || 1;
          
          if (currentDeviceCount >= maxDevices) {
            if (forceLogoutOldest || force_logout_oldest) {
              while (currentDeviceCount >= maxDevices) {
                await db.query(`DELETE FROM devices WHERE id IN (SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1)`, [user.id]);
                currentDeviceCount--;
              }
            } else {
              return res.status(403).json({ success: false, error: 'DEVICE_LIMIT_REACHED', message: 'Device limit reached. Do you want to logout your oldest device to continue?' });
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

    return success(res, {
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
    return error(res, err.message ? `Google authentication failed: ${err.message}` : 'Google authentication failed', 401);
  }
};

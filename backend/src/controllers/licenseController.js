const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.activate = async (req, res) => {
  try {
    // BUG-11 FIX: Accept platform from request body; don't hardcode 'android'
    const { license_key, device_id, device_name, app_version, platform } = req.body;
    const userId = req.user.id;

    if (!license_key) return error(res, 'License key is required', 400);

    // Find license - explicitly select fields to avoid column name conflicts
    const licenseResult = await db.query(
      'SELECT l.id, l.license_key, l.user_id, l.status AS license_status, l.duration_days, l.max_devices AS license_max_devices, l.activated_at, l.expires_at, p.name as plan_name, p.duration_days AS plan_duration_days, p.max_devices AS plan_max_devices FROM licenses l LEFT JOIN plans p ON l.plan_id = p.id WHERE l.license_key = $1',
      [license_key]
    );

    if (licenseResult.rows.length === 0) {
      return error(res, 'Invalid license key', 400);
    }

    const license = licenseResult.rows[0];

    // Check if already used by another user
    if (license.user_id && license.user_id !== userId) {
      return error(res, 'This license key has already been used by another account', 400);
    }

    // Check statuses — including expired
    if (license.license_status === 'revoked') return error(res, 'This license has been revoked', 400);
    if (license.license_status === 'suspended') return error(res, 'This license has been suspended', 400);
    if (license.license_status === 'blocked') return error(res, 'This license has been blocked', 400);
    if (license.license_status === 'expired') return error(res, 'This license has expired', 400);

    // Check user status
    const userResult = await db.query('SELECT status FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0].status === 'blocked') {
      return error(res, 'Your account has been blocked. Please contact support.', 403);
    }

    // Device limit check
    if (device_id) {
      const deviceResult = await db.query(
        'SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      const deviceCount = parseInt(deviceResult.rows[0].count);
      // Use license table value, fall back to plan value, then default to 1
      const maxDevices = license.license_max_devices || license.plan_max_devices || 1;

      const existingDevice = await db.query(
        'SELECT id FROM devices WHERE user_id = $1 AND device_id = $2',
        [userId, device_id]
      );

      let currentDeviceCount = deviceCount;
      if (existingDevice.rows.length === 0) {
        if (currentDeviceCount >= maxDevices) {
          if (req.body.forceLogoutOldest) {
            while (currentDeviceCount >= maxDevices) {
              await db.query(`
                DELETE FROM devices 
                WHERE id IN (
                  SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1
                )
              `, [userId]);
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
      }

      if (existingDevice.rows.length === 0) {
        await db.query(
          'INSERT INTO devices (user_id, license_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, license.id, device_id, device_name || 'Unknown', app_version || '1.0.0', platform || 'android']
        );
      }
    }

    // Activate license
    const now = new Date();
    const durationDays = license.duration_days || license.plan_duration_days || 30;
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await db.query(
      'UPDATE licenses SET user_id = $1, status = $2, activated_at = $3, expires_at = $4, updated_at = NOW() WHERE id = $5',
      [userId, 'active', now, expiresAt, license.id]
    );

    const remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    success(res, {
      license_key: license.license_key,
      status: 'active',
      plan_name: license.plan_name,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      remaining_days: remainingDays,
      max_devices: license.license_max_devices || license.plan_max_devices || 1,
    }, 'License activated successfully');
  } catch (err) {
    console.error('License activation error:', err);
    error(res, 'Failed to activate license', 500);
  }
};

exports.status = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT l.*, p.name as plan_name FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
       ORDER BY l.expires_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return success(res, { status: 'none' });
    }

    const license = result.rows[0];
    const now = new Date();
    const isExpired = new Date(license.expires_at) <= now;

    // Fix #23: Handle expiry for both 'active' AND 'trial' statuses
    if (isExpired && (license.status === 'active' || license.status === 'trial')) {
      await db.query("UPDATE licenses SET status = 'expired' WHERE id = $1 AND status IN ('active', 'trial')", [license.id]);
      license.status = 'expired';
    }

    const remainingDays = Math.max(0, Math.ceil((new Date(license.expires_at) - now) / (1000 * 60 * 60 * 24)));

    success(res, {
      id: license.id,
      license_key: license.license_key,
      status: license.status,
      plan_name: license.plan_name,
      duration_days: license.duration_days,
      max_devices: license.max_devices,
      activated_at: license.activated_at,
      expires_at: license.expires_at,
      remaining_days: remainingDays,
    });
  } catch (err) {
    error(res, 'Failed to fetch license status', 500);
  }
};

exports.validate = async (req, res) => {
  try {
    const { license_key } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT l.*, p.name as plan_name FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE l.license_key = $1 AND l.user_id = $2`,
      [license_key, userId]
    );

    if (result.rows.length === 0) {
      return error(res, 'License not found or not associated with your account', 404);
    }

    const license = result.rows[0];
    const now = new Date();
    const isExpired = new Date(license.expires_at) <= now;

    if (isExpired && (license.status === 'active' || license.status === 'trial')) {
      await db.query("UPDATE licenses SET status = 'expired' WHERE id = $1 AND status IN ('active', 'trial')", [license.id]);
      license.status = 'expired';
    }

    const remainingDays = Math.max(0, Math.ceil((new Date(license.expires_at) - now) / (1000 * 60 * 60 * 24)));

    success(res, {
      is_valid: !isExpired && license.status === 'active',
      status: license.status,
      plan_name: license.plan_name,
      remaining_days: remainingDays,
    });
  } catch (err) {
    error(res, 'Failed to validate license', 500);
  }
};

exports.history = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT l.*, p.name as plan_name FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE l.user_id = $1 ORDER BY l.created_at DESC`,
      [userId]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch license history', 500);
  }
};

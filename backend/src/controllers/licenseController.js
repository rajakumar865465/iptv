const db = require('../config/db');
const { success, error } = require('../utils/response');
const cache = require('../utils/cache');
const {
  MS_PER_DAY,
  normalizePlanTier,
  isLicenseStatusUsable,
  remainingDays: calcRemainingDays,
  resolveUserLicense,
} = require('../services/subscriptionService');

exports.activate = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { license_key, device_id, device_name, app_version, platform } = req.body;
    const userId = req.user.id;
    const cleanKey = license_key ? String(license_key).trim() : '';

    if (!cleanKey) return error(res, 'License key is required', 400);

    const licenseResult = await client.query(
      `SELECT l.id, l.license_key, l.user_id, l.customer_email, l.status AS license_status,
              l.duration_days, l.max_devices AS license_max_devices, l.activated_at, l.expires_at,
              p.name AS plan_name, p.plan_tier, p.duration_days AS plan_duration_days, p.max_devices AS plan_max_devices
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE UPPER(TRIM(l.license_key)) = UPPER($1)`,
      [cleanKey]
    );

    if (licenseResult.rows.length === 0) {
      return error(res, 'Invalid license key', 400);
    }

    const license = licenseResult.rows[0];
    const now = new Date();

    // Check if already used by another user
    if (license.user_id && license.user_id !== userId) {
      return error(res, 'This license key has already been used by another account', 400);
    }

    // Check non-activatable statuses
    if (license.license_status === 'revoked') return error(res, 'This license has been revoked', 400);
    if (license.license_status === 'suspended') return error(res, 'This license has been suspended', 400);
    if (license.license_status === 'blocked') return error(res, 'This license has been blocked', 400);
    if (license.license_status === 'pending_payment') return error(res, 'Payment for this license is still pending verification', 400);
    if (license.license_status === 'expired') return error(res, 'This license has expired', 400);

    // Check if an active/trial/already-timed license is already past its expires_at
    if (license.expires_at && new Date(license.expires_at) <= now) {
      await client.query(
        "UPDATE licenses SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status IN ('active', 'trial')",
        [license.id]
      );
      return error(res, 'This license has expired', 400);
    }

    // Check user status
    const userResult = await client.query('SELECT status FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return error(res, 'User not found', 404);
    }
    if (userResult.rows[0].status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: 'USER_BLOCKED',
        error_code: 'USER_BLOCKED',
        message: 'Your account has been blocked. Please contact support.',
      });
    }

    const durationDays = license.duration_days || license.plan_duration_days || 30;
    const maxDevices = license.license_max_devices || license.plan_max_devices || 1;
    const alreadyActivated = Boolean(license.activated_at && license.expires_at && new Date(license.expires_at) > now);
    const effectiveStatus = license.license_status === 'trial' ? 'trial' : 'active';
    const activatedAt = alreadyActivated ? new Date(license.activated_at) : now;
    const expiresAt = alreadyActivated
      ? new Date(license.expires_at)
      : new Date(now.getTime() + durationDays * MS_PER_DAY);

    await client.query('BEGIN');

    const activateResult = await client.query(
      `UPDATE licenses
       SET user_id = $1, status = $2, activated_at = $3, expires_at = $4, updated_at = NOW()
       WHERE id = $5 AND (user_id IS NULL OR user_id = $1)
       RETURNING *`,
      [userId, effectiveStatus, activatedAt, expiresAt, license.id]
    );

    if (activateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return error(res, 'This license key has already been used by another account', 400);
    }

    // Device limit check — only runs once activation is confirmed
    if (device_id) {
      const deviceResult = await client.query(
        'SELECT COUNT(*) FROM devices WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      const deviceCount = parseInt(deviceResult.rows[0].count, 10);

      const existingDevice = await client.query(
        'SELECT id FROM devices WHERE user_id = $1 AND device_id = $2',
        [userId, device_id]
      );

      let currentDeviceCount = deviceCount;
      if (existingDevice.rows.length === 0) {
        if (currentDeviceCount >= maxDevices) {
          if (req.body.forceLogoutOldest || req.body.force_logout_oldest) {
            while (currentDeviceCount >= maxDevices) {
              await client.query(`
                DELETE FROM devices
                WHERE id IN (
                  SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1
                )
              `, [userId]);
              currentDeviceCount--;
            }
          } else {
            await client.query('ROLLBACK');
            return res.status(403).json({
              success: false,
              error: 'DEVICE_LIMIT_REACHED',
              error_code: 'DEVICE_LIMIT_REACHED',
              message: 'Device limit reached. Do you want to logout your oldest device to continue?'
            });
          }
        }

        await client.query(
          'INSERT INTO devices (user_id, license_id, device_id, device_name, app_version, platform) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, license.id, device_id, device_name || 'Unknown', app_version || '1.0.0', platform || 'android']
        );
      } else {
        await client.query(
          'UPDATE devices SET license_id = $1, last_active_at = NOW(), app_version = $2 WHERE id = $3',
          [license.id, app_version || '1.0.0', existingDevice.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    cache.invalidatePlaybackCache(userId);

    const remaining = calcRemainingDays(expiresAt, now);
    const planTier = normalizePlanTier(license.plan_tier);

    success(res, {
      id: license.id,
      license_key: license.license_key,
      status: effectiveStatus,
      plan_name: license.plan_name,
      plan_tier: planTier,
      duration_days: durationDays,
      activated_at: activatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      remaining_days: remaining,
      max_devices: maxDevices,
    }, 'License activated successfully');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('License activation error:', err);
    error(res, 'Failed to activate license', 500);
  } finally {
    client.release();
  }
};

exports.status = async (req, res) => {
  try {
    const userId = req.user.id;
    const resolved = await resolveUserLicense(db, {
      userId,
      email: req.user.email || null,
      autoLink: true,
    });

    if (!resolved.effectiveLicense) {
      return success(res, {
        status: 'none',
        plan_tier: 'free',
        remaining_days: 0,
      });
    }

    const lic = resolved.effectiveLicense;
    const isUsable = isLicenseStatusUsable(lic.status) && resolved.remainingDays > 0;

    success(res, {
      id: lic.id,
      license_key: lic.license_key,
      status: lic.status,
      plan_name: lic.plan_name,
      plan_tier: isUsable ? resolved.effectivePlanTier : 'free',
      duration_days: lic.duration_days || lic.plan_duration_days,
      max_devices: lic.max_devices || lic.plan_max_devices || 1,
      activated_at: lic.activated_at,
      expires_at: lic.expires_at,
      remaining_days: resolved.remainingDays,
    });
  } catch (err) {
    console.error('License status error:', err);
    error(res, 'Failed to fetch license status', 500);
  }
};

exports.validate = async (req, res) => {
  try {
    const { license_key } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email || '';

    const result = await db.query(
      `SELECT l.*, p.name AS plan_name, p.plan_tier, p.duration_days AS plan_duration_days, p.max_devices AS plan_max_devices
       FROM licenses l
       LEFT JOIN plans p ON l.plan_id = p.id
       WHERE UPPER(TRIM(l.license_key)) = UPPER(TRIM($1))
         AND (l.user_id = $2 OR ($3 != '' AND l.customer_email IS NOT NULL AND LOWER(l.customer_email) = LOWER($3)))`,
      [license_key || '', userId, userEmail]
    );

    if (result.rows.length === 0) {
      return error(res, 'License not found or not associated with your account', 404);
    }

    const license = result.rows[0];
    const now = new Date();
    const isExpired = !license.expires_at || new Date(license.expires_at) <= now;

    if (isExpired && isLicenseStatusUsable(license.status)) {
      await db.query("UPDATE licenses SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status IN ('active', 'trial')", [license.id]);
      license.status = 'expired';
    }

    const isValid = !isExpired && isLicenseStatusUsable(license.status);
    const remaining = isValid ? calcRemainingDays(license.expires_at, now) : 0;

    success(res, {
      id: license.id,
      license_key: license.license_key,
      is_valid: isValid,
      status: license.status,
      plan_name: license.plan_name,
      plan_tier: isValid ? normalizePlanTier(license.plan_tier) : 'free',
      duration_days: license.duration_days || license.plan_duration_days,
      max_devices: license.max_devices || license.plan_max_devices || 1,
      expires_at: license.expires_at,
      remaining_days: remaining,
    });
  } catch (err) {
    error(res, 'Failed to validate license', 500);
  }
};

exports.history = async (req, res) => {
  try {
    const userId = req.user.id;
    const resolved = await resolveUserLicense(db, {
      userId,
      email: req.user.email || null,
      autoLink: true,
    });
    const rows = resolved.allLicenses.map((row) => ({
      ...row,
      plan_tier: normalizePlanTier(row.plan_tier),
    }));
    success(res, rows);
  } catch (err) {
    error(res, 'Failed to fetch license history', 500);
  }
};

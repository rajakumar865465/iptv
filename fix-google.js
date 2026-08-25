const fs = require('fs');
let content = fs.readFileSync('backend/src/controllers/googleAuthController.js', 'utf8');

const replacement = `
    const { generateToken, generateRefreshToken } = require('../utils/jwt');

    // Inside exports.googleLogin... after user check:
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    
    let license = null;
    let licenseStatus = 'none';
    let deviceCount = { rows: [{ count: 0 }] };
    const now = new Date();
    
    const { device_id, device_name, app_version, forceLogoutOldest, force_logout_oldest } = req.body;
    
    try {
      const licenseResult = await db.query(
        \`SELECT l.*, p.name as plan_name, p.plan_tier FROM licenses l
         LEFT JOIN plans p ON l.plan_id = p.id
         WHERE l.user_id = $1 AND l.status IN ('active', 'trial', 'pending_payment')
         ORDER BY l.expires_at DESC LIMIT 1\`,
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
                await db.query(\`DELETE FROM devices WHERE id IN (SELECT id FROM devices WHERE user_id = $1 ORDER BY last_active_at ASC LIMIT 1)\`, [user.id]);
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
`;

content = content.replace(/const \{ generateToken \} = require\('\.\.\/utils\/jwt'\);/, "const { generateToken, generateRefreshToken } = require('../utils/jwt');");

content = content.replace(/\/\/\s*Generate standard JWT token[\s\S]*?'Login successful'\);/, replacement.split('// Inside exports.googleLogin... after user check:')[1]);

fs.writeFileSync('backend/src/controllers/googleAuthController.js', content);

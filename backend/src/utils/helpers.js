// Fix #20: Use cryptographically secure random bytes instead of Math.random()
const { randomBytes } = require('crypto');

const generateLicenseKey = () => {
  return Array.from({ length: 4 }, () =>
    randomBytes(3).toString('hex').toUpperCase()
  ).join('-');
};

const formatLicenseResponse = (license, planName, remainingDays) => ({
  id: license.id,
  license_key: license.license_key,
  status: license.status,
  plan_name: planName || 'Trial',
  duration_days: license.duration_days,
  max_devices: license.max_devices,
  activated_at: license.activated_at,
  expires_at: license.expires_at,
  remaining_days: remainingDays,
});

module.exports = { generateLicenseKey, formatLicenseResponse };

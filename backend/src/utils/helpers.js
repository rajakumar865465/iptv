const generateLicenseKey = () => {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(Math.random().toString(36).substring(2, 8).toUpperCase());
  }
  return segments.join('-');
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

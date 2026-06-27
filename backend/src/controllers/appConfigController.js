const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getConfig = async (req, res) => {
  try {
    const result = await db.query('SELECT setting_key, setting_value FROM app_settings');
    const config = {};
    result.rows.forEach(row => {
      config[row.setting_key] = row.setting_value;
    });
    success(res, config);
  } catch (err) {
    error(res, 'Failed to fetch app config', 500);
  }
};

exports.getStatus = async (req, res) => {
  try {
    success(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    error(res, 'Failed to fetch status', 500);
  }
};

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareSemver(a, b) {
  const parse = (v) => v.split('.').map(n => parseInt(n.replace(/[^0-9]/g, ''), 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

exports.versionCheck = async (req, res) => {
  try {
    const { version } = req.query;
    const result = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'minimum_app_version'");
    const minVersion = result.rows[0]?.setting_value || '1.0.0';

    const isUpdateRequired = version && compareSemver(version, minVersion) < 0;

    success(res, {
      current_version: version || '1.0.0',
      minimum_version: minVersion,
      update_required: isUpdateRequired,
      force_update: result.rows[0]?.setting_value === 'true',
    });
  } catch (err) {
    error(res, 'Failed to check version', 500);
  }
};

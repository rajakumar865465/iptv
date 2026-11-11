const db = require('../config/db');
const { success, error } = require('../utils/response');

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareSemver(a, b) {
  const parse = (v) => (v || '').split('.').map(n => parseInt(n.replace(/[^0-9]/g, ''), 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

exports.getConfig = async (req, res) => {
  try {
    const [settingsResult, releaseResult] = await Promise.all([
      db.query('SELECT setting_key, setting_value FROM app_settings'),
      db.query(`SELECT version, apk_url, force_update FROM app_releases WHERE is_latest = true ORDER BY created_at DESC LIMIT 1`)
    ]);

    const config = {};
    settingsResult.rows.forEach(row => {
      config[row.setting_key] = row.setting_value;
    });

    const latestRelease = releaseResult.rows[0] || null;
    if (latestRelease) {
      if (latestRelease.force_update === true) {
        config['force_update'] = 'true';
        if (!config['minimum_app_version'] || compareSemver(latestRelease.version, config['minimum_app_version']) > 0) {
          config['minimum_app_version'] = latestRelease.version;
        }
      }
      if (!config['latest_app_version']) {
        config['latest_app_version'] = latestRelease.version;
      }
      if (!config['apk_download_url'] && latestRelease.apk_url) {
        config['apk_download_url'] = latestRelease.apk_url;
      }
    }

    const clientVersion = req.query.version || req.headers['x-app-version'] || req.headers['app-version'];
    const minVersion = config['minimum_app_version'] || '1.0.0';

    // If force_update is enabled in settings or releases:
    // If client version is provided and is >= minimum_app_version (e.g. 2.8.7),
    // they are already on the required version and should NOT be blocked!
    if (config['force_update'] === 'true' && clientVersion) {
      if (compareSemver(clientVersion, minVersion) >= 0) {
        config['force_update'] = 'false';
      }
    }

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

exports.versionCheck = async (req, res) => {
  try {
    const clientVersion = req.query.version || req.headers['x-app-version'] || req.headers['app-version'] || '';
    const [settingsRes, releaseRes] = await Promise.all([
      db.query(
        `SELECT setting_key, setting_value
         FROM app_settings
         WHERE setting_key = ANY($1)`,
        [[
          'minimum_app_version',
          'latest_app_version',
          'force_update',
          'apk_download_url',
          'announcement_message',
          'banner_message',
        ]]
      ),
      db.query(
        `SELECT version, apk_url, force_update
         FROM app_releases
         WHERE is_latest = true
         ORDER BY created_at DESC
         LIMIT 1`
      ),
    ]);

    const settings = {};
    settingsRes.rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });

    const latestRelease = releaseRes.rows[0] || null;
    const minVersion = settings.minimum_app_version || '1.0.0';
    const latestVersion = settings.latest_app_version || latestRelease?.version || minVersion;
    const forceEnabled = settings.force_update === 'true' || latestRelease?.force_update === true;
    const isBelowMin = !clientVersion || compareSemver(clientVersion, minVersion) < 0;
    const isOutdated = !clientVersion || compareSemver(clientVersion, latestVersion) < 0;

    success(res, {
      current_version: clientVersion || '1.0.0',
      minimum_version: minVersion,
      latest_version: latestVersion,
      update_required: Boolean(isBelowMin || (forceEnabled && isOutdated)),
      force_update: Boolean(forceEnabled && isBelowMin),
      apk_download_url: settings.apk_download_url || latestRelease?.apk_url || '/downloads/app-release.apk',
      download_page_url: '/download',
      announcement_message: settings.announcement_message || settings.banner_message || '',
    });
  } catch (err) {
    error(res, 'Failed to check version', 500);
  }
};

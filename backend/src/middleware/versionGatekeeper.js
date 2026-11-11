const db = require('../config/db');

// In-memory cache for app version config so DB isn't queried on every API hit
let cachedConfig = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

function compareSemver(a, b) {
  const parse = (v) => (v || '').split('.').map((n) => parseInt(n.replace(/[^0-9]/g, ''), 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

async function getEnforcementConfig() {
  const now = Date.now();
  if (cachedConfig && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const [settingsRes, releaseRes] = await Promise.all([
      db.query(
        `SELECT setting_key, setting_value FROM app_settings
         WHERE setting_key IN ('force_update', 'minimum_app_version', 'latest_app_version', 'apk_download_url')`
      ),
      db.query(
        `SELECT version, apk_url, force_update FROM app_releases
         WHERE is_latest = true ORDER BY created_at DESC LIMIT 1`
      ),
    ]);

    const settings = {};
    settingsRes.rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });

    const latestRelease = releaseRes.rows[0] || null;

    // Force update is active if enabled in EITHER app_settings OR app_releases
    const isForceUpdate =
      settings.force_update === 'true' || latestRelease?.force_update === true;

    let minVersion = settings.minimum_app_version || '1.0.0';
    if (latestRelease && isForceUpdate) {
      if (compareSemver(latestRelease.version, minVersion) > 0) {
        minVersion = latestRelease.version;
      }
    }

    const latestVersion = settings.latest_app_version || latestRelease?.version || minVersion;
    const apkUrl = settings.apk_download_url || latestRelease?.apk_url || '/downloads/app-release.apk';

    cachedConfig = {
      isForceUpdate,
      minVersion,
      latestVersion,
      apkUrl,
    };
    lastCacheTime = now;
    return cachedConfig;
  } catch (err) {
    console.error('[versionGatekeeper] Failed to fetch settings:', err.message);
    return (
      cachedConfig || {
        isForceUpdate: false,
        minVersion: '1.0.0',
        latestVersion: '1.0.0',
        apkUrl: '/downloads/app-release.apk',
      }
    );
  }
}

function invalidateVersionCache() {
  cachedConfig = null;
  lastCacheTime = 0;
}

const versionGatekeeper = async (req, res, next) => {
  const fullPath = (req.originalUrl || req.url || '').split('?')[0];

  // 1. Never gate public configuration, discovery, downloads, health, or admin management
  if (
    fullPath.startsWith('/api/app') ||
    fullPath.startsWith('/api/public') ||
    fullPath.startsWith('/api/internal') ||
    fullPath.startsWith('/api/ws') ||
    fullPath.startsWith('/health') ||
    fullPath.startsWith('/api/health') ||
    fullPath === '/' ||
    fullPath.startsWith('/downloads') ||
    fullPath.startsWith('/logos') ||
    fullPath.startsWith('/.well-known')
  ) {
    return next();
  }

  // 2. Identify the client platform
  const userAgent = req.header('user-agent') || '';
  const origin = req.header('Origin') || '';
  const isDart = userAgent.startsWith('Dart/') || userAgent.includes('dart:io');
  const isMobileHeader = !!(
    req.headers['x-app-version'] ||
    req.headers['app-version'] ||
    userAgent.includes('NivaTV')
  );

  // Allow web browsers, localhost, and Next.js server components
  if (!isDart && !isMobileHeader && (origin || userAgent.includes('Mozilla') || userAgent.includes('node-fetch'))) {
    return next();
  }

  // 3. Check if force update is enabled
  const config = await getEnforcementConfig();
  if (!config.isForceUpdate) {
    return next();
  }

  // 4. Extract client version
  let clientVersion =
    req.headers['x-app-version'] || req.headers['app-version'] || req.query.version;
  if (!clientVersion && userAgent.includes('NivaTV/')) {
    const match = userAgent.match(/NivaTV\/([0-9.]+)/);
    if (match) clientVersion = match[1];
  }

  // 5. Evaluate if the client is below the required minimum version
  const isOutdated = !clientVersion || compareSemver(clientVersion, config.minVersion) < 0;

  // Block mobile app clients (Dart User-Agent, mobile app headers, or mobile clients accessing protected channels/playback/home)
  if (isOutdated && (isDart || isMobileHeader || !origin)) {
    return res.status(426).json({
      success: false,
      error: 'FORCE_UPDATE_REQUIRED',
      message: `A mandatory update to NivaTV v${config.latestVersion} is required to continue streaming.`,
      data: {
        current_version: clientVersion || 'unknown',
        minimum_version: config.minVersion,
        latest_version: config.latestVersion,
        apk_download_url: config.apkUrl,
        download_page_url: '/download',
      },
    });
  }

  next();
};

module.exports = {
  versionGatekeeper,
  invalidateVersionCache,
  compareSemver,
};

// Shared safety guard for one-off admin bootstrap/repair scripts.
//
// These scripts can create or modify admin accounts, so they must never run
// silently against production. Both a production confirmation flag AND an
// explicit, non-default password are required every time.
'use strict';

function requireExplicitConfirmation(scriptName) {
  const isProd = process.env.NODE_ENV === 'production';
  const confirmed = process.argv.includes('--confirm-prod');
  if (isProd && !confirmed) {
    console.error(`[SAFETY] Refusing to run ${scriptName} with NODE_ENV=production.`);
    console.error('This script can create or overwrite admin credentials.');
    console.error('Re-run with --confirm-prod only if you are certain this is intentional.');
    process.exit(1);
  }
}

function getBootstrapPassword() {
  const pwd = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!pwd || pwd.length < 12) {
    console.error('[SAFETY] ADMIN_BOOTSTRAP_PASSWORD is not set (or is too short).');
    console.error('Set it to a strong, random password before running this script, e.g.:');
    console.error('  ADMIN_BOOTSTRAP_PASSWORD="<a long random string>" node scripts/create-admin.js');
    process.exit(1);
  }
  return pwd;
}

function getBootstrapEmail(defaultEmail) {
  return process.env.ADMIN_BOOTSTRAP_EMAIL || defaultEmail;
}

module.exports = { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail };

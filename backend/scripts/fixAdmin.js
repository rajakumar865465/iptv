require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail } = require('./_adminSafety');

async function fixAdmin() {
  requireExplicitConfirmation('fixAdmin.js');
  const rawPassword = getBootstrapPassword();
  const email = getBootstrapEmail('admin@nivatv.in');

  try {
    const check = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length === 0) {
      console.error(`No user found with email ${email}. Nothing to fix.`);
      process.exit(1);
    }
    const pwd = await hashPassword(rawPassword);
    await db.query("UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = $2", [pwd, email]);
    console.log(`Successfully fixed ${email} (role=admin, status=active, password reset).`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

fixAdmin();

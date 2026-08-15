require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail } = require('./_adminSafety');

async function resetAdmin() {
  requireExplicitConfirmation('resetAdmin.js');
  const rawPassword = getBootstrapPassword();
  const email = getBootstrapEmail('admin@nivatv.in');

  try {
    const check = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length === 0) {
      console.error(`No user found with email ${email}. Nothing to reset.`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(rawPassword);
    await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    console.log(`Password reset successfully for ${email}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

resetAdmin();

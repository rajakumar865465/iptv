require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail } = require('./_adminSafety');

async function createSuperAdmin() {
  requireExplicitConfirmation('createSuperAdmin.js');
  const rawPassword = getBootstrapPassword();
  const email = getBootstrapEmail('superadmin@nivatv.in');

  try {
    const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      console.log('Superadmin already exists. Resetting password...');
      const passwordHash = await hashPassword(rawPassword);
      await db.query("UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = $2", [passwordHash, email]);
      console.log('Reset successful.');
    } else {
      console.log('Creating new superadmin...');
      const passwordHash = await hashPassword(rawPassword);
      await db.query(
        'INSERT INTO users (full_name, email, mobile, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6)',
        ['Super Admin', email, '1234567890', passwordHash, 'admin', 'active']
      );
      console.log('Creation successful. Email: ' + email);
    }
    // NOTE: this script intentionally no longer touches any other account
    // (it used to also blindly reset admin@nivatv.in on every run — removed,
    // see resetAdmin.js/fixAdmin.js if that account specifically needs repair,
    // both of which now require the same explicit confirmation + password).
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

createSuperAdmin();

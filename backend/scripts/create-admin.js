require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail } = require('./_adminSafety');

async function createAdmin() {
  requireExplicitConfirmation('create-admin.js');
  const password = getBootstrapPassword();
  const email = getBootstrapEmail('admin@nivatv.in');
  const fullName = 'System Admin';
  const mobile = '1234567890';

  try {
    // Check if admin already exists
    const checkRes = await pool.query('SELECT id FROM users WHERE email = $1 OR role = $2', [email, 'admin']);
    if (checkRes.rows.length > 0) {
      console.log('An admin user already exists in the database.');
      return;
    }

    const hashedPassword = await hashPassword(password);

    await pool.query(
      `INSERT INTO users (full_name, email, mobile, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fullName, email, mobile, hashedPassword, 'admin', 'active']
    );

    console.log('Default admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log('Password: (the value you provided via ADMIN_BOOTSTRAP_PASSWORD — not printed)');
  } catch (err) {
    console.error('Failed to create admin user:', err.message);
  } finally {
    await pool.end();
  }
}

createAdmin();

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { requireExplicitConfirmation, getBootstrapPassword, getBootstrapEmail } = require('./_adminSafety');

async function checkAdmins() {
  try {
    const res = await db.query("SELECT id, email, role FROM users WHERE role = 'admin'");
    console.log('Admin users in DB:', res.rows);
    if (res.rows.length === 0) {
      console.log('No admins found.');
      requireExplicitConfirmation('checkAdmin.js (create default admin)');
      const passwordHash = await hashPassword(getBootstrapPassword());
      const email = getBootstrapEmail('admin@example.com');
      const insert = await db.query(
        "INSERT INTO users (full_name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role",
        ['Admin User', email, passwordHash, 'admin', 'active']
      );
      console.log('Created admin:', insert.rows[0]);
    } else {
      console.log('Use this email:', res.rows[0].email);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkAdmins();

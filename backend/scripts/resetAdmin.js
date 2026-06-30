require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function resetAdmin() {
  try {
    const passwordHash = await hashPassword('password123');
    await db.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@nivatv.in'", [passwordHash]);
    console.log("Password reset successfully for admin@nivatv.in");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

resetAdmin();

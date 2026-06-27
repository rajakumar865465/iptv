require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function fixAdmin() {
  try {
    const pwd = await hashPassword('password123');
    await db.query("UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = 'admin@iptvapp.com'", [pwd]);
    console.log("Successfully fixed admin@iptvapp.com with password123, role=admin, status=active");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

fixAdmin();

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function recreateAdmin() {
  try {
    const email = 'admin@iptvapp.com';
    const pwd = await hashPassword('password123');

    const check = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (check.rows.length === 0) {
      console.log("Admin user is missing. Re-inserting...");
      // Using a random mobile to avoid conflicts if they messed up
      const randomMobile = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      await db.query(
        "INSERT INTO users (full_name, email, mobile, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6)",
        ['Admin User', email, randomMobile, pwd, 'admin', 'active']
      );
      console.log("Successfully re-created admin account!");
    } else {
      console.log("Admin exists, updating just in case...");
      await db.query(
        "UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = $2",
        [pwd, email]
      );
      console.log("Successfully updated existing admin account!");
    }
  } catch (err) {
    console.error("Error recreating admin:", err);
  } finally {
    process.exit(0);
  }
}

recreateAdmin();

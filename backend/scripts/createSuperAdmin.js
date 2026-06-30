require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function createSuperAdmin() {
  try {
    const email = 'superadmin@nivatv.in';
    const rawPassword = 'password123';
    
    const check = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (check.rows.length > 0) {
      console.log("Superadmin already exists. Resetting password...");
      const passwordHash = await hashPassword(rawPassword);
      await db.query("UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = $2", [passwordHash, email]);
      console.log("Reset successful.");
    } else {
      console.log("Creating new superadmin...");
      const passwordHash = await hashPassword(rawPassword);
      await db.query(
        "INSERT INTO users (full_name, email, mobile, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6)",
        ['Super Admin', email, '1234567890', passwordHash, 'admin', 'active']
      );
      console.log("Creation successful. Email: " + email + ", Password: " + rawPassword);
    }
    
    // Also let's fix admin@nivatv.in if it's broken
    const adminCheck = await db.query("SELECT * FROM users WHERE email = 'admin@nivatv.in'");
    if (adminCheck.rows.length > 0) {
      console.log("Fixing admin@nivatv.in role/status/mobile just in case...");
      const pwd = await hashPassword('password123');
      await db.query("UPDATE users SET password_hash = $1, role = 'admin', status = 'active', mobile = COALESCE(mobile, '0000000000') WHERE email = 'admin@nivatv.in'", [pwd]);
      console.log("Fixed admin@nivatv.in");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

createSuperAdmin();

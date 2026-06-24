const db = require('./src/config/db');

async function resetLicense() {
  try {
    await db.query(
      "UPDATE licenses SET user_id = NULL, status = 'unused', activated_at = NULL, expires_at = NULL WHERE license_key = 'TEST-LICENSE-2026'"
    );
    console.log('License reset successfully.');
    
    // Also delete any devices attached to user 2 just in case
    await db.query("DELETE FROM devices");
    console.log('Devices cleared.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

resetLicense();

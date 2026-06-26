const db = require('./src/config/db');

async function check() {
  try {
    const res = await db.query("SELECT COUNT(*) FROM channels WHERE status = 'active' AND health_status = 'online' AND stream_url IS NOT NULL AND stream_url != ''");
    console.log("Channels with valid streams:", res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();

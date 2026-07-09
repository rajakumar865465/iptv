require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    const url = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    
    // Check if it exists
    const res = await db.query('SELECT id FROM channel_streams WHERE stream_url = $1', [url]);
    if (res.rows.length === 0) {
      await db.query(`
        INSERT INTO channel_streams (channel_id, stream_url, health_status, priority, is_active, playback_mode)
        VALUES (31, $1, 'online', 99, true, 'direct')
      `, [url]);
      console.log('Mux stream added to channel 31');
    } else {
      console.log('Mux stream already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

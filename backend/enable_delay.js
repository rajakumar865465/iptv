const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // 1. Pick a valid channel
    let res = await client.query('SELECT c.id FROM channels c JOIN channel_streams cs ON cs.channel_id = c.id LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No valid channels found.');
      return;
    }
    const channelId = res.rows[0].id;
    console.log(`Setting up channel ${channelId} for delayed playback...`);

    // 2. Enable delayed playback (delay = 300s)
    await client.query(`
      UPDATE channels 
      SET playback_mode = 'delayed', delay_seconds = 300 
      WHERE id = $1
    `, [channelId]);

    // 3. Notify backend via HTTP (or wait for the scanner if it runs)
    // Actually, setting it in the DB might not instantly trigger the recorder unless we hit /api/internal/smooth-playback/:id/enable
    // Or we hit the playback endpoint. 
    console.log(`Enabled in DB for channel ${channelId}.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();

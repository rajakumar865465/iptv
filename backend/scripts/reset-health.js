require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

async function main() {
  console.log('Resetting all channel health statuses to unknown to force a rescan...');
  
  await db.query(`UPDATE channel_streams SET health_status = 'unknown'`);
  await db.query(`UPDATE channels SET health_status = 'unknown', is_hidden = false`);
  
  console.log('All channels unhidden and reset to unknown. The scanner will re-evaluate them shortly.');
  await db.pool.end();
}

main().catch(console.error);

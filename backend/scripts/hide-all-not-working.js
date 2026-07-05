require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

async function main() {
  console.log('Hiding all not-working channels globally...');
  
  // Hide channels that are not perfectly 'online'
  const result = await db.query(`
    UPDATE channels 
    SET is_hidden = true 
    WHERE health_status != 'online' AND is_hidden = false
  `);
  
  console.log(`Successfully auto-hid ${result.rowCount} channels that were not fully 'online'.`);
  
  // Also hide channel streams that are offline so they aren't tried
  const streamResult = await db.query(`
    UPDATE channel_streams
    SET is_hidden = true
    WHERE health_status != 'online' AND is_hidden = false
  `);
  
  console.log(`Successfully auto-hid ${streamResult.rowCount} broken individual streams.`);
  
  await db.pool.end();
}

main().catch(console.error);

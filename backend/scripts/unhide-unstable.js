require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

async function main() {
  console.log('Ensuring all working and unstable channels (especially paid ones) are visible...');

  // Unhide channels that are 'online' or 'unstable'
  const result = await db.query(`
    UPDATE channels 
    SET is_hidden = false 
    WHERE health_status IN ('online', 'unstable') AND is_hidden = true
  `);
  console.log(`Successfully unhid ${result.rowCount} channels that were marked online/unstable.`);

  // Print summary of Paid channels
  const paidStats = await db.query(`
    SELECT health_status, is_hidden, COUNT(*) as count 
    FROM channels 
    WHERE is_premium = true 
    GROUP BY health_status, is_hidden 
    ORDER BY health_status
  `);
  
  console.log('\n--- Paid Channels Status ---');
  console.table(paidStats.rows);
  
  // Print summary of All channels
  const allStats = await db.query(`
    SELECT health_status, is_hidden, COUNT(*) as count 
    FROM channels 
    GROUP BY health_status, is_hidden 
    ORDER BY health_status
  `);
  
  console.log('\n--- All Channels Status ---');
  console.table(allStats.rows);

  await db.pool.end();
}

main().catch(console.error);

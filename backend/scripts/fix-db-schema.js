require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

async function main() {
  try {
    await db.query(`ALTER TABLE channel_streams ADD COLUMN IF NOT EXISTS license_type VARCHAR(30) DEFAULT 'free'`);
    console.log('Successfully added license_type to channel_streams');
  } catch (err) {
    console.error('Error adding column:', err.message);
  }
  await db.pool.end();
}

main().catch(console.error);

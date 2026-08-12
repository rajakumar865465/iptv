require('dotenv').config({ path: './.env' });
const db = require('./src/config/db');

async function check() {
  try {
    const res = await db.query(`
      SELECT id, name, is_premium, is_paid, health_status, status
      FROM channels 
      WHERE name ILIKE '%star sports%'
    `);
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();

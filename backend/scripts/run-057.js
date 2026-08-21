const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function run() {
  const sqlFile = path.join(__dirname, '..', 'migrations', '057_manual_payment_system.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migration 057 executed successfully: Manual Payment System tables added.');
  } catch (err) {
    console.error('Migration 057 failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();

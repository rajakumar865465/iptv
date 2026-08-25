const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function run() {
  const sqlFile = path.join(__dirname, '..', 'migrations', '058_add_decoy_plan.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migration 058 executed successfully: Added Decoy Plan and Price Anchoring.');
  } catch (err) {
    console.error('Migration 058 failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();

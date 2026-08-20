const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function run() {
  const sqlFile = path.join(__dirname, '..', 'migrations', '056_update_app_release_v28.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migration 056 executed successfully: App release updated to v2.8.0 (32.5 MB).');
  } catch (err) {
    console.error('Migration 056 failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();

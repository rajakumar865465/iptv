const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigrations() {
  const migrationFile = path.join(__dirname, '..', 'migrations', '001_init.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

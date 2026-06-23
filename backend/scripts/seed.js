const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runSeeds() {
  const seedFile = path.join(__dirname, '..', 'seeds', 'seed.sql');
  const sql = fs.readFileSync(seedFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Seed data inserted successfully');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeeds();

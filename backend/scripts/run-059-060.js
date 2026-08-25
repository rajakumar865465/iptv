const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigration(file, label) {
  const sqlFile = path.join(__dirname, '..', 'migrations', file);
  const sql = fs.readFileSync(sqlFile, 'utf8');
  try {
    await pool.query(sql);
    console.log(`✅ ${label} executed successfully.`);
  } catch (err) {
    console.error(`❌ ${label} failed:`, err.message);
    throw err;
  }
}

async function run() {
  try {
    await runMigration('059_plan_channel_tiers.sql', 'Migration 059 - Add channel_tier & plan_tier columns');
    await runMigration('060_seed_plan_tiers.sql', 'Migration 060 - Seed tiered plan structure');
    console.log('\n🎉 All tier migrations completed successfully!');
  } catch (err) {
    console.error('\n💥 Migration failed, see error above.');
  } finally {
    await pool.end();
  }
}

run();

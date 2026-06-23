const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'iptv_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Executed: ${path.basename(filePath)}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error in ${path.basename(filePath)}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function init() {
  console.log('Starting database initialization...');
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      await runMigration(path.join(migrationsDir, file));
    }
  }

  console.log('Database initialization complete!');
  await pool.end();
}

init().catch(err => {
  console.error('Initialization failed:', err);
  process.exit(1);
});

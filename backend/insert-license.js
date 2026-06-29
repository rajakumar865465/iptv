require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function main() {
  try {
    await pool.query(
      `INSERT INTO licenses (license_key, status, duration_days, max_devices) 
       VALUES ('035081-BE993B-A53DB5-4E095B', 'active', 30, 1)`
    );
    console.log('Inserted license successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();

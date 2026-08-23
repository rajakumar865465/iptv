const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixPaymentMode() {
  try {
    const res = await pool.query("UPDATE app_settings SET setting_value = 'both' WHERE setting_key = 'payment_mode' RETURNING *");
    console.log('Updated payment_mode to both:', res.rows);
    if (res.rows.length === 0) {
      console.log('setting_key not found, inserting it...');
      const insertRes = await pool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('payment_mode', 'both') RETURNING *");
      console.log('Inserted:', insertRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

fixPaymentMode();

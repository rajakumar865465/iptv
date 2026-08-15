require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to connect without an explicit connection string.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

client.connect().then(async () => {
  try {
    const res3 = await client.query('SELECT * FROM channels LIMIT 1');
    console.log('Sample channel:', res3.rows[0]);

    // Also check the status column if it exists
    const res2 = await client.query('SELECT count(*) as count, status FROM channels GROUP BY status');
    console.log('By status:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.end();
  }
});

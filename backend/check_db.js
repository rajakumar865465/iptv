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

client.connect().then(() => {
  client.query('SELECT id, name, stream_url, health_status FROM channels LIMIT 5').then(res => {
    console.log(res.rows);
    client.end();
  });
}).catch(console.error);

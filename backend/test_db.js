const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://iptvdb:JdKD9dbx1wha4P5jyDMwU8NsE8z6wJNd@dpg-d8tbqf4m0tmc73c6j6hg-a.oregon-postgres.render.com/iptv_db2',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  try {
    const res3 = await client.query('SELECT * FROM channels LIMIT 1');
    console.log("Sample channel:", res3.rows[0]);
    
    // Also check the status column if it exists
    const res2 = await client.query('SELECT count(*) as count, status FROM channels GROUP BY status');
    console.log("By status:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.end();
  }
});

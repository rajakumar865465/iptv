const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query("SELECT id, name, logo_url FROM channels WHERE logo_url IS NOT NULL AND logo_url != ''");
    let fixedCount = 0;
    
    for (const row of res.rows) {
      let newUrl = row.logo_url;
      
      // Fix Wikipedia Thumbnails (400 Bad Request error)
      if (newUrl.includes('upload.wikimedia.org/wikipedia/commons/thumb/')) {
        newUrl = newUrl.replace(/\/thumb(\/.*)\/[^\/]+$/, '$1');
      }
      
      // Fix Dead Imgur Links (Aastha, CNBC Awaaz, etc)
      // Dead imgur links usually redirect to a removed.png, we just null them out
      // or replace with known good ones if possible, but nulling falls back to Initials (e.g. AT)
      if (newUrl.includes('imgur.com')) {
        newUrl = null; 
      }
      
      if (newUrl !== row.logo_url) {
        console.log(`Fixing ${row.name}: ${row.logo_url} -> ${newUrl}`);
        await pool.query('UPDATE channels SET logo_url = $1 WHERE id = $2', [newUrl, row.id]);
        fixedCount++;
      }
    }
    console.log(`Fixed ${fixedCount} channel logos.`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();

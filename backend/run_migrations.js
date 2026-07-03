const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Add columns directly if migrations are failing due to dependencies
    await client.query(`
      ALTER TABLE channels 
      ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(20) DEFAULT 'direct',
      ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delayed_stream_url TEXT;
    `);
    
    const files = [
      'migrations/035_delayed_buffer_sessions.sql',
      'migrations/036_delayed_buffer_segments.sql',
    ];
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        const sql = fs.readFileSync(file, 'utf8');
        await client.query(sql);
        console.log(`Successfully ran ${file}`);
      }
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();

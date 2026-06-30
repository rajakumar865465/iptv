const db = require('../src/config/db');

async function fixIndex() {
  try {
    console.log("Dropping old constraint...");
    await db.query(`ALTER TABLE channel_streams DROP CONSTRAINT IF EXISTS channel_streams_channel_id_stream_url_key CASCADE`);
    
    console.log("Creating new index based on MD5...");
    await db.query(`CREATE UNIQUE INDEX channel_streams_channel_id_stream_url_hash_key ON channel_streams (channel_id, md5(stream_url))`);
    
    console.log("Index fixed!");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
fixIndex();

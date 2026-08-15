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
  return client.query(`
SELECT 
  c.id as channel_id,
  c.name as channel_name,
  s.id as stream_id,
  s.stream_url,
  s.final_url,
  c.health_status as channel_health_status,
  s.health_status as stream_health_status,
  c.is_hidden as channel_is_hidden,
  c.is_removed as channel_is_removed,
  c.is_visible_app as channel_is_visible_app,
  s.is_hidden as stream_is_hidden,
  s.is_active as stream_is_active,
  s.license_type,
  c.playback_mode,
  c.proxy_allowed
FROM channel_streams s
JOIN channels c ON s.channel_id = c.id
WHERE s.id = 31;`);
}).then(res => {
  console.log(JSON.stringify(res.rows[0], null, 2));
  process.exit(0);
}).catch(console.error);

const db = require('../src/config/db');
db.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'channel_streams_channel_id_stream_url_key'")
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(console.error);

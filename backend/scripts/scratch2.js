const db = require('../src/config/db');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'channel_streams'")
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(console.error);

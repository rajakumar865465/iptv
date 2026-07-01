const db = require('../src/config/db');
db.query("UPDATE channels SET status = 'active' WHERE id IN (SELECT DISTINCT channel_id FROM channel_streams)")
  .then(r => { console.log(`Activated ${r.rowCount} channels`); process.exit(0); })
  .catch(console.error);

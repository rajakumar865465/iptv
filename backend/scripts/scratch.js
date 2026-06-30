const db = require('../src/config/db');
db.query(`SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'channels'::regclass;`)
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(console.error);

const db = require('./src/config/db');

async function run() {
  await db.query(`DELETE FROM plans WHERE id IN (958, 959, 960, 961, 962, 963, 964)`);
  console.log('Deleted duplicate plans.');
  process.exit(0);
}
run();

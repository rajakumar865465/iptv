const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function run() {
  const hash = await bcrypt.hash('password', 10);
  await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'demo12@gmail.com']);
  console.log('Password updated');
  process.exit(0);
}
run();

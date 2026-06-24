const db = require('./src/config/db');

async function checkData() {
  try {
    const licenses = await db.query('SELECT * FROM licenses');
    console.log('Licenses:', licenses.rows);

    const users = await db.query('SELECT * FROM users');
    console.log('Users:', users.rows);

    console.error(e);
  } finally {
    process.exit();
  }
}

checkData();

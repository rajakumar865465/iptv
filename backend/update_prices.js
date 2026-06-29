const db = require('./src/config/db');

(async () => {
  try {
    const res1 = await db.query('UPDATE plans SET price = 149.00, regular_price = 349.00 WHERE name = $1', ['3 Months']);
    console.log('3 Months updated rows:', res1.rowCount);

    const res2 = await db.query('UPDATE plans SET price = 349.00, regular_price = 999.00 WHERE name = $1', ['1 Year']);
    console.log('1 Year updated rows:', res2.rowCount);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

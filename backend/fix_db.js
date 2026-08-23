const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://iptvdb:SecureDbPass9aF2xL8qP3@35.154.128.217:5432/iptv_db'
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE payments p
      SET amount = p.amount / 100
      FROM public_orders po
      WHERE p.order_id = po.order_id
        AND p.amount = po.amount
        AND p.payment_method = 'razorpay'
      RETURNING p.id, p.amount as new_amount, po.amount as old_amount;
    `);
    console.log('Fixed payments:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();

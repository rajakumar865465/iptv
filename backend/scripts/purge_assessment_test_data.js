const db = require('../src/config/db');

async function purgeAssessmentTestData() {
  console.log('--- PURGING PEN-TEST ASSESSMENT DATA ---');
  try {
    // 1. Find test orders
    const ordersRes = await db.query(
      `SELECT order_id, email, customer_name, license_id 
       FROM public_orders 
       WHERE LOWER(email) LIKE '%@test.com' 
          OR LOWER(email) LIKE '%@example.com'
          OR LOWER(email) LIKE '%pentester%'
          OR customer_name ILIKE '%security%' 
          OR customer_name ILIKE '%probe%'
          OR customer_name ILIKE '%test%'`
    );
    console.log(`Found ${ordersRes.rows.length} test orders to purge.`);

    const licenseIds = ordersRes.rows.map(r => r.license_id).filter(Boolean);

    // 2. Delete test redemptions
    await db.query(
      `DELETE FROM coupon_redemptions WHERE order_id IN (
         SELECT order_id FROM public_orders 
         WHERE LOWER(email) LIKE '%@test.com' 
            OR LOWER(email) LIKE '%@example.com'
            OR LOWER(email) LIKE '%pentester%'
       )`
    );

    // 3. Delete test orders
    const delOrders = await db.query(
      `DELETE FROM public_orders 
       WHERE LOWER(email) LIKE '%@test.com' 
          OR LOWER(email) LIKE '%@example.com'
          OR LOWER(email) LIKE '%pentester%'
          OR customer_name ILIKE '%security%' 
          OR customer_name ILIKE '%probe%'
          OR customer_name ILIKE '%test%'
       RETURNING order_id`
    );
    console.log(`Deleted ${delOrders.rows.length} test public_orders.`);

    // 4. Delete or revoke test licenses
    if (licenseIds.length > 0) {
      const delLic = await db.query(
        `DELETE FROM licenses WHERE id = ANY($1) RETURNING id, license_key`,
        [licenseIds]
      );
      console.log(`Deleted ${delLic.rows.length} test licenses.`);
    }

    // 5. Delete test users
    const delUsers = await db.query(
      `DELETE FROM users 
       WHERE LOWER(email) LIKE '%@test.com' 
          OR full_name ILIKE '%security test%'
       RETURNING id, email`
    );
    console.log(`Deleted ${delUsers.rows.length} test users.`);

    console.log('--- PURGE COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Purge error:', err);
    process.exit(1);
  }
}

purgeAssessmentTestData();

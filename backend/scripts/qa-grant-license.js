// QA helper: give the QA test user an active license so the app can be exercised.
// Safe + idempotent: only touches user id 39's license rows.
const path = require('path');
const db = require(path.join(__dirname, '../src/config/db'));

(async () => {
  const email = 'qa.tester@nivatv.in';
  const { rows: users } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!users.length) {
    console.error('QA user not found');
    process.exit(1);
  }
  const uid = users[0].id;
  const key = 'QA-AUTO-LICENSE-0001';

  const { rows: existing } = await db.query('SELECT * FROM licenses WHERE user_id = $1', [uid]);
  console.log('existing licenses for user', uid, ':', existing.length);

  if (existing.length) {
    await db.query(
      `UPDATE licenses
          SET status = 'active',
              activated_at = NOW(),
              expires_at = NOW() + INTERVAL '365 days',
              max_devices = 5
        WHERE user_id = $1`,
      [uid]
    );
    console.log('refreshed existing license(s) -> active, 365d, 5 devices');
  } else {
    await db.query(
      `INSERT INTO licenses (license_key, user_id, status, duration_days, max_devices, activated_at, expires_at)
       VALUES ($1, $2, 'active', 365, 5, NOW(), NOW() + INTERVAL '365 days')`,
      [key, uid]
    );
    console.log('created license', key);
  }

  const { rows: after } = await db.query(
    'SELECT id, license_key, status, expires_at, max_devices FROM licenses WHERE user_id = $1',
    [uid]
  );
  console.log(after);
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

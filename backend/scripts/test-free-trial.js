const db = require('../src/config/db');
const { ensureUserTrial } = require('../src/services/subscriptionService');

async function runTest() {
  console.log('--- STARTING FREE TRIAL E2E TEST ---');

  const testEmail = `test_trial_${Date.now()}@example.com`;
  console.log(`Creating test user: ${testEmail}`);

  // 1. Create a test user
  const userRes = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role, status, has_claimed_trial)
     VALUES ('Test Trial User', $1, 'dummy_hash', 'user', 'active', false)
     RETURNING id, full_name, email, has_claimed_trial`,
    [testEmail]
  );
  const user = userRes.rows[0];
  console.log(`User created. ID: ${user.id}, has_claimed_trial: ${user.has_claimed_trial}`);

  try {
    // 2. Call ensureUserTrial for first time
    console.log('Attempting ensureUserTrial for user ID:', user.id);
    const trialLicense = await ensureUserTrial(user.id);
    console.log('Result of first ensureUserTrial:', trialLicense ? {
      id: trialLicense.id,
      license_key: trialLicense.license_key,
      status: trialLicense.status,
      duration_days: trialLicense.duration_days,
      max_devices: trialLicense.max_devices,
      plan_name: trialLicense.plan_name,
      plan_tier: trialLicense.plan_tier,
      expires_at: trialLicense.expires_at,
    } : null);

    if (!trialLicense) {
      throw new Error('Trial license was not created!');
    }

    if (trialLicense.duration_days !== 30 || trialLicense.max_devices !== 1 || trialLicense.plan_tier !== 'pro') {
      throw new Error(`Invalid trial attributes: duration=${trialLicense.duration_days}, devices=${trialLicense.max_devices}, tier=${trialLicense.plan_tier}`);
    }

    // 3. Verify user has_claimed_trial flag in DB
    const checkUser = await db.query('SELECT has_claimed_trial FROM users WHERE id = $1', [user.id]);
    console.log('User has_claimed_trial in DB:', checkUser.rows[0].has_claimed_trial);
    if (!checkUser.rows[0].has_claimed_trial) {
      throw new Error('User has_claimed_trial is not true!');
    }

    // 4. Verify public order created with 0 amount
    const checkOrder = await db.query('SELECT * FROM public_orders WHERE user_id = $1', [user.id]);
    console.log(`Orders found for user: ${checkOrder.rows.length}, amount: ${checkOrder.rows[0]?.amount}, status: ${checkOrder.rows[0]?.status}`);
    const orderAmt = parseFloat(checkOrder.rows[0]?.amount);
    if (checkOrder.rows.length === 0 || orderAmt !== 0) {
      throw new Error('Public order with 0 amount not found!');
    }

    // 5. Attempt second claim - must be blocked
    console.log('Attempting second ensureUserTrial (should be blocked)...');
    const secondTry = await ensureUserTrial(user.id);
    console.log('Second try result:', secondTry);
    if (secondTry !== null) {
      throw new Error('Second trial attempt was not blocked!');
    }

    console.log('ALL E2E TEST ASSERTIONS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup test data
    console.log('Cleaning up test data...');
    await db.query('DELETE FROM public_orders WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM licenses WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('Test data cleaned up.');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

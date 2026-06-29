const db = require('../src/config/db');

(async () => {
  try {
    console.log('=== Fix Pricing Plans Script ===');

    const finalSlugs = [
      'trial-1-day',
      'seven-days',
      'one-month',
      'three-months',
      'six-months',
      'one-year'
    ];

    // 1. Identify non-final plans
    const allPlansResult = await db.query(
      `SELECT id, name, slug, price, regular_price, status, is_visible, sort_order
       FROM plans
       ORDER BY id ASC`
    );

    console.log(`Found ${allPlansResult.rows.length} total plans in DB`);

    const nonFinalPlans = allPlansResult.rows.filter(p => !finalSlugs.includes(p.slug));
    console.log(`Non-final plans to process: ${nonFinalPlans.length}`);

    for (const plan of nonFinalPlans) {
      const linkedResult = await db.query(
        `SELECT
          (SELECT COUNT(*) FROM licenses WHERE plan_id = $1) AS license_count,
          (SELECT COUNT(*) FROM payments WHERE plan_id = $1) AS payment_count,
          (SELECT COUNT(*) FROM public_orders WHERE plan_id = $1) AS order_count`,
        [plan.id]
      );

      const { license_count, payment_count, order_count } = linkedResult.rows[0];
      const hasLinks = parseInt(license_count) > 0 || parseInt(payment_count) > 0 || parseInt(order_count) > 0;

      if (hasLinks) {
        await db.query(
          `UPDATE plans SET is_active = false, is_visible = false, status = 'archived' WHERE id = $1`,
          [plan.id]
        );
        console.log(`Archived linked plan id=${plan.id} ${plan.name} (licenses:${license_count}, payments:${payment_count}, orders:${order_count})`);
      } else {
        await db.query(`DELETE FROM plans WHERE id = $1`, [plan.id]);
        console.log(`Deleted unused plan id=${plan.id} ${plan.name}`);
      }
    }

    // 2. Deduplicate final slugs: keep the one with lowest id for each
    for (const slug of finalSlugs) {
      const dupResult = await db.query(
        `SELECT id FROM plans WHERE slug = $1 ORDER BY id ASC`,
        [slug]
      );
      if (dupResult.rows.length > 1) {
        const keepId = dupResult.rows[0].id;
        const dupIds = dupResult.rows.slice(1).map(r => r.id);
        console.log(`Deduplicating slug "${slug}": keeping id=${keepId}, removing ${dupIds.length} duplicates`);
        for (const dupId of dupIds) {
          const linkedResult = await db.query(
            `SELECT
              (SELECT COUNT(*) FROM licenses WHERE plan_id = $1) AS license_count,
              (SELECT COUNT(*) FROM payments WHERE plan_id = $1) AS payment_count,
              (SELECT COUNT(*) FROM public_orders WHERE plan_id = $1) AS order_count`,
            [dupId]
          );
          const { license_count, payment_count, order_count } = linkedResult.rows[0];
          const hasLinks = parseInt(license_count) > 0 || parseInt(payment_count) > 0 || parseInt(order_count) > 0;
          if (hasLinks) {
            await db.query(
              `UPDATE plans SET is_active = false, is_visible = false, status = 'archived' WHERE id = $1`,
              [dupId]
            );
            console.log(`  Archived duplicate id=${dupId} (linked)`);
          } else {
            await db.query(`DELETE FROM plans WHERE id = $1`, [dupId]);
            console.log(`  Deleted duplicate id=${dupId}`);
          }
        }
      }
    }

    // 3. Upsert final 6 plans
    const finalPlans = [
      { name: '1 Day Trial', slug: 'trial-1-day', duration_days: 1, device_limit: 1, regular_price: 19, offer_price: 0, badge: 'Free Trial', is_popular: false, is_best_value: false, sort_order: 1, is_active: true, is_visible: true },
      { name: '7 Days', slug: 'seven-days', duration_days: 7, device_limit: 1, regular_price: 79, offer_price: 49, badge: 'Try First', is_popular: false, is_best_value: false, sort_order: 2, is_active: true, is_visible: true },
      { name: '1 Month', slug: 'one-month', duration_days: 30, device_limit: 1, regular_price: 199, offer_price: 129, badge: 'Starter', is_popular: false, is_best_value: false, sort_order: 3, is_active: true, is_visible: true },
      { name: '3 Months', slug: 'three-months', duration_days: 90, device_limit: 2, regular_price: 499, offer_price: 299, badge: 'Most Popular', is_popular: true, is_best_value: false, sort_order: 4, is_active: true, is_visible: true },
      { name: '6 Months', slug: 'six-months', duration_days: 180, device_limit: 3, regular_price: 899, offer_price: 499, badge: 'Save More', is_popular: false, is_best_value: false, sort_order: 5, is_active: true, is_visible: true },
      { name: '1 Year', slug: 'one-year', duration_days: 365, device_limit: 5, regular_price: 1299, offer_price: 999, badge: 'Best Value', is_popular: false, is_best_value: true, sort_order: 6, is_active: true, is_visible: true },
    ];

    for (const plan of finalPlans) {
      // Check if plan exists by slug
      const existing = await db.query(`SELECT id FROM plans WHERE slug = $1`, [plan.slug]);
      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE plans SET
            name = $1,
            price = $2,
            regular_price = $3,
            duration_days = $4,
            max_devices = $5,
            offer_label = $6,
            is_popular = $7,
            is_best_value = $8,
            sort_order = $9,
            is_active = $10,
            is_visible = $11,
            status = 'active'
          WHERE slug = $12`,
          [
            plan.name, plan.offer_price, plan.regular_price, plan.duration_days, plan.device_limit,
            plan.badge, plan.is_popular, plan.is_best_value, plan.sort_order,
            plan.is_active, plan.is_visible, plan.slug
          ]
        );
        console.log(`Updated plan: ${plan.name}`);
      } else {
        await db.query(
          `INSERT INTO plans (name, slug, price, regular_price, duration_days, max_devices, offer_label, is_popular, is_best_value, sort_order, is_active, is_visible, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')`,
          [
            plan.name, plan.slug, plan.offer_price, plan.regular_price, plan.duration_days, plan.device_limit,
            plan.badge, plan.is_popular, plan.is_best_value, plan.sort_order,
            plan.is_active, plan.is_visible
          ]
        );
        console.log(`Inserted plan: ${plan.name}`);
      }
    }

    // 4. Add unique index on slug if missing
    try {
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_slug_unique ON plans(slug)`);
      console.log('Unique index on plans.slug ensured');
    } catch (e) {
      console.log('Unique index on slug may already exist or failed:', e.message);
    }

    // 5. Verify results
    const verifyResult = await db.query(
      `SELECT id, name, slug, price, regular_price, is_active, is_visible, status, sort_order
       FROM plans
       ORDER BY sort_order ASC`
    );
    console.log('\n=== Final Plans ===');
    for (const row of verifyResult.rows) {
      console.log(`  id=${row.id} name=${row.name} slug=${row.slug} price=${row.price} regular_price=${row.regular_price} active=${row.is_active} visible=${row.is_visible} status=${row.status} sort=${row.sort_order}`);
    }

    const publicCount = await db.query(
      `SELECT COUNT(*) FROM plans WHERE is_active = true AND is_visible = true AND COALESCE(status, 'active') != 'archived'`
    );
    console.log(`\nPublic visible plans count: ${publicCount.rows[0].count} (expected: 6)`);

    const dupResult = await db.query(
      `SELECT slug, COUNT(*) FROM plans GROUP BY slug HAVING COUNT(*) > 1`
    );
    if (dupResult.rows.length === 0) {
      console.log('Duplicate slugs: None');
    } else {
      console.log('Duplicate slugs found:');
      for (const row of dupResult.rows) {
        console.log(`  ${row.slug}: ${row.count}`);
      }
    }

    console.log('\n=== DONE ===');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

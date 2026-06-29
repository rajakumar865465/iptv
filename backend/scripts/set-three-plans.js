/**
 * Consolidates public plans to 3 visible + 1 hidden offer plan.
 * Visible: 1 Day Trial (free), 1 Month, 1 Year.
 * Hidden:  7 Days (offer-only, shown via scratch card after free trial).
 *
 * Run: node backend/scripts/set-three-plans.js
 */

const db = require('../src/config/db');

// The hidden 7-day offer plan — purchasable but not listed publicly
const OFFER_PLAN = {
  slug: 'seven-days-offer',
  name: '7 Days',
  duration_days: 7,
  price: 49,
  regular_price: 79,
  max_devices: 1,
  offer_label: 'Special Offer',
  is_popular: false,
  is_best_value: false,
  sort_order: 0,
};

const THREE_PLANS = [
  {
    slug: 'trial-1-day',
    name: '1 Day Trial',
    duration_days: 1,
    price: 0,
    regular_price: 19,
    max_devices: 1,
    offer_label: 'Free Trial',
    is_popular: false,
    is_best_value: false,
    sort_order: 1,
  },
  {
    slug: 'one-month',
    name: '1 Month',
    duration_days: 30,
    price: 149,
    regular_price: 199,
    max_devices: 1,
    offer_label: 'Most Popular',
    is_popular: true,
    is_best_value: false,
    sort_order: 2,
  },
  {
    slug: 'one-year',
    name: '1 Year',
    duration_days: 365,
    price: 999,
    regular_price: 1799,
    max_devices: 5,
    offer_label: 'Best Value',
    is_popular: false,
    is_best_value: true,
    sort_order: 3,
  },
];

const KEEP_SLUGS = new Set([...THREE_PLANS.map(p => p.slug), OFFER_PLAN.slug]);

(async () => {
  try {
    console.log('=== Set Three Plans ===');

    // 1. Archive or delete plans not in our final set
    const { rows: allPlans } = await db.query(
      `SELECT id, name, slug FROM plans ORDER BY id ASC`
    );
    console.log(`Total plans in DB: ${allPlans.length}`);

    for (const plan of allPlans) {
      if (KEEP_SLUGS.has(plan.slug)) continue;

      const { rows: [counts] } = await db.query(
        `SELECT
          (SELECT COUNT(*) FROM licenses      WHERE plan_id = $1) AS licenses,
          (SELECT COUNT(*) FROM payments      WHERE plan_id = $1) AS payments,
          (SELECT COUNT(*) FROM public_orders WHERE plan_id = $1) AS orders`,
        [plan.id]
      );
      const linked = parseInt(counts.licenses) > 0 || parseInt(counts.payments) > 0 || parseInt(counts.orders) > 0;

      if (linked) {
        await db.query(
          `UPDATE plans SET is_active = false, is_visible = false, status = 'archived' WHERE id = $1`,
          [plan.id]
        );
        console.log(`  Archived (has links): id=${plan.id} "${plan.name}"`);
      } else {
        await db.query(`DELETE FROM plans WHERE id = $1`, [plan.id]);
        console.log(`  Deleted (unused): id=${plan.id} "${plan.name}"`);
      }
    }

    // 2. Upsert all four plans (3 visible + 1 hidden offer)
    const ALL_PLANS = [...THREE_PLANS, OFFER_PLAN];
    for (const p of ALL_PLANS) {
      const isOffer = p.slug === OFFER_PLAN.slug;
      const { rows: existing } = await db.query(
        `SELECT id FROM plans WHERE slug = $1 LIMIT 1`, [p.slug]
      );

      if (existing.length > 0) {
        await db.query(
          `UPDATE plans SET
            name = $1, duration_days = $2, price = $3, regular_price = $4,
            max_devices = $5, offer_label = $6, is_popular = $7,
            is_best_value = $8, sort_order = $9,
            is_active = true, is_visible = $10, status = 'active'
          WHERE slug = $11`,
          [
            p.name, p.duration_days, p.price, p.regular_price,
            p.max_devices, p.offer_label, p.is_popular,
            p.is_best_value, p.sort_order, !isOffer, p.slug,
          ]
        );
        console.log(`  Updated: "${p.name}" (visible=${!isOffer})`);
      } else {
        await db.query(
          `INSERT INTO plans
            (slug, name, duration_days, price, regular_price, max_devices,
             offer_label, is_popular, is_best_value, sort_order,
             is_active, is_visible, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,'active')`,
          [
            p.slug, p.name, p.duration_days, p.price, p.regular_price,
            p.max_devices, p.offer_label, p.is_popular, p.is_best_value, p.sort_order,
            !isOffer,
          ]
        );
        console.log(`  Inserted: "${p.name}" (visible=${!isOffer})`);
      }
    }

    // 3. Verify
    const { rows: final } = await db.query(
      `SELECT id, name, slug, price, duration_days, max_devices, is_active, is_visible, sort_order
       FROM plans WHERE is_active = true
       ORDER BY sort_order ASC`
    );
    console.log('\n=== Active plans ===');
    for (const r of final) {
      const vis = r.is_visible ? 'public' : 'hidden (offer)';
      console.log(`  [${r.sort_order}] ${r.name} | ₹${r.price} | ${r.duration_days}d | ${r.max_devices} device(s) | ${vis}`);
    }
    const publicCount = final.filter(r => r.is_visible).length;
    console.log(`\nPublic: ${publicCount} (expected: 3)  |  Hidden offer: ${final.length - publicCount} (expected: 1)`);
    console.log('=== DONE ===');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

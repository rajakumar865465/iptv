const db = require('./backend/src/config/db');

async function fixPlans() {
  try {
    // 1. Starter Plan (30 days)
    await db.query(\
      UPDATE plans 
      SET name = 'Starter', plan_tier = 'starter', price = 99, 
          description = 'Best choice for regular viewers', is_popular = true, sort_order = 10 
      WHERE duration_days = 30
    \);

    // 2. Pro Plan (180 days)
    await db.query(\
      UPDATE plans 
      SET name = 'Pro', plan_tier = 'pro', price = 499, 
          description = 'Save more with half-year access', sort_order = 20 
      WHERE duration_days = 180
    \);

    // 3. Plus Plan (365 days)
    await db.query(\
      UPDATE plans 
      SET name = 'Plus', plan_tier = 'plus', price = 799, 
          description = 'Best value for family use', is_best_value = true, offer_label = 'Family Plan', sort_order = 30 
      WHERE duration_days >= 365
    \);

    console.log('Plans updated successfully to Starter, Pro, and Plus!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update plans:', err);
    process.exit(1);
  }
}

fixPlans();

const db = require('../src/config/db');

(async () => {
  try {
    // Step 1: Mark all duplicate plans as inactive/hidden (keep IDs 1, 2, 17, 18, 19, 20 as the originals)
    const duplicateIds = [839, 840, 841, 842, 843, 844, 845, 846, 847, 848, 849, 850, 851, 852];

    for (const id of duplicateIds) {
      await db.query(
        'UPDATE plans SET status = $1, is_visible = $2 WHERE id = $3',
        ['inactive', false, id]
      );
      console.log(`Marked plan ${id} as inactive`);
    }

    // Step 2: Reset original plan prices to correct values
    const updates = [
      { id: 1, name: '1 Day Trial', price: 0, regular_price: 19, duration_days: 1, max_devices: 1, offer_label: 'Free Trial', is_popular: false, is_best_value: false, sort_order: 0 },
      { id: 2, name: '7 Days Plan', price: 49, regular_price: 79, duration_days: 7, max_devices: 1, offer_label: 'Try First', is_popular: false, is_best_value: false, sort_order: 1 },
      { id: 3, name: '15 Days Plan', price: 99, regular_price: 149, duration_days: 15, max_devices: 1, offer_label: 'Starter', is_popular: false, is_best_value: false, sort_order: 2 },
      { id: 17, name: '1 Month', price: 149, regular_price: 199, duration_days: 30, max_devices: 1, offer_label: 'Monthly', is_popular: false, is_best_value: false, sort_order: 3 },
      { id: 18, name: '3 Months', price: 399, regular_price: 499, duration_days: 90, max_devices: 3, offer_label: 'Most Popular', is_popular: true, is_best_value: false, sort_order: 4 },
      { id: 19, name: '6 Months', price: 699, regular_price: 899, duration_days: 180, max_devices: 3, offer_label: 'Save More', is_popular: false, is_best_value: false, sort_order: 5 },
      { id: 20, name: '1 Year', price: 1199, regular_price: 1499, duration_days: 365, max_devices: 5, offer_label: 'Best Value', is_popular: false, is_best_value: true, sort_order: 6 },
    ];

    for (const plan of updates) {
      await db.query(
        `UPDATE plans SET
          name = $1, price = $2, regular_price = $3, duration_days = $4,
          max_devices = $5, offer_label = $6, is_popular = $7, is_best_value = $8,
          sort_order = $9, status = 'active', is_visible = true
        WHERE id = $10`,
        [plan.name, plan.price, plan.regular_price, plan.duration_days, plan.max_devices,
         plan.offer_label, plan.is_popular, plan.is_best_value, plan.sort_order, plan.id]
      );
      console.log(`Updated ${plan.name} plan`);
    }

    console.log('Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

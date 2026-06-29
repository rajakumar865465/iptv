const db = require('../src/config/db');

(async () => {
  try {
    const updates = [
      { id: 1, name: '1 Day Trial', price: 0.00, regular_price: 19.00, duration_days: 1, max_devices: 1, description: 'Free trial for 1 day', offer_label: 'Free Trial', is_popular: false, is_best_value: false, sort_order: 0 },
      { id: 2, name: '7 Days', price: 49.00, regular_price: 79.00, duration_days: 7, max_devices: 1, description: 'One week access to all channels', offer_label: 'Try First', is_popular: false, is_best_value: false, sort_order: 1 },
      { id: 3, name: '15 Days Plan', price: 99.00, regular_price: 149.00, duration_days: 15, max_devices: 1, description: 'Biweekly plan', offer_label: 'Starter', is_popular: false, is_best_value: false, sort_order: 2 },
      { id: 17, name: '1 Month', price: 149.00, regular_price: 199.00, duration_days: 30, max_devices: 1, description: 'Full month access on 1 device', offer_label: 'Monthly', is_popular: false, is_best_value: false, sort_order: 3 },
      { id: 18, name: '3 Months', price: 399.00, regular_price: 499.00, duration_days: 90, max_devices: 3, description: 'Quarterly plan with access on up to 3 devices', offer_label: 'Most Popular', is_popular: true, is_best_value: false, sort_order: 4 },
      { id: 19, name: '6 Months', price: 699.00, regular_price: 899.00, duration_days: 180, max_devices: 3, description: 'Half yearly plan - best value', offer_label: 'Save More', is_popular: false, is_best_value: false, sort_order: 5 },
      { id: 20, name: '1 Year', price: 1199.00, regular_price: 1499.00, duration_days: 365, max_devices: 5, description: 'Full year access on up to 5 devices - best deal', offer_label: 'Best Value', is_popular: false, is_best_value: true, sort_order: 6 },
    ];

    for (const plan of updates) {
      await db.query(
        `UPDATE plans SET
          name = $1, price = $2, regular_price = $3, duration_days = $4,
          max_devices = $5, description = $6, offer_label = $7, is_popular = $8,
          is_best_value = $9, sort_order = $10, status = 'active', is_visible = true
        WHERE id = $11`,
        [plan.name, plan.price, plan.regular_price, plan.duration_days, plan.max_devices,
         plan.description, plan.offer_label, plan.is_popular, plan.is_best_value, plan.sort_order, plan.id]
      );
      console.log(`Updated: ${plan.name}`);
    }

    // Mark any other active plans as inactive
    const keepIds = [1, 2, 3, 17, 18, 19, 20];
    const res = await db.query('SELECT id, name FROM plans WHERE status = $1 AND is_visible = $2', ['active', true]);
    for (const row of res.rows) {
      if (!keepIds.includes(row.id)) {
        await db.query('UPDATE plans SET status = $1, is_visible = $2 WHERE id = $3', ['inactive', false, row.id]);
        console.log(`Deactivated plan id=${row.id} ${row.name}`);
      }
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

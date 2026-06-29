#!/usr/bin/env node
// Insert 1-day free trial plan into the database
const db = require('./src/config/db');

async function insertPlan() {
  try {
    // Check if plan already exists by name or slug
    const checkResult = await db.query(
      `SELECT id, name, slug FROM plans WHERE name = '1 Day Trial' OR slug = 'trial-1-day' LIMIT 1`
    );

    if (checkResult.rows.length > 0) {
      // Update existing plan
      await db.query(
        `UPDATE plans
         SET name = $1, price = $2, duration_days = $3, max_devices = $4,
             description = $5, status = $6, is_active = $7, is_visible = $8, sort_order = $9
         WHERE id = $10`,
        [
          '1 Day Trial', 0, 1, 1, 'Free trial for 1 day', 'active', true, true, 0,
          checkResult.rows[0].id
        ]
      );
      console.log('1 Day Trial plan updated (ID: ' + checkResult.rows[0].id + ')');
    } else {
      // Insert new plan
      const insertResult = await db.query(
        `INSERT INTO plans (name, slug, price, duration_days, max_devices, description, status, is_active, is_visible, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          '1 Day Trial', 'trial-1-day', 0, 1, 1, 'Free trial for 1 day', 'active', true, true, 0
        ]
      );
      console.log('1 Day Trial plan inserted (ID: ' + insertResult.rows[0].id + ')');
    }

    // Show耕Show all plans
    const result = await db.query(
      'SELECT id, name, slug, price, duration_days, max_devices, description, status, is_active, is_visible FROM plans ORDER BY sort_order ASC, id ASC'
    );
    console.log('\nCurrent plans:');
    for (const row of result.rows) {
      console.log(`  ${row.id}: ${row.name} | ₹${row.price} | ${row.duration_days}d | ${row.max_devices} device(s) | status=${row.status} active=${row.is_active} visible=${row.is_visible}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

insertPlan();

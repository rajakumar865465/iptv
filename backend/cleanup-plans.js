#!/usr/bin/env node
// Clean up duplicate plans, keep only the latest active ones
const db = require('./src/config/db');

async function cleanup() {
  try {
    // Keep the most recent active plan for each name
    const result = await db.query(
      `WITH latest AS (
        SELECT MAX(id) as max_id, name
        FROM plans
        GROUP BY name
      )
      SELECT p.id, p.name, p.status, p.is_active
      FROM plans p
      JOIN latest l ON p.name = l.name AND p.id = l.max_id
      ORDER BY p.id ASC`
    );
    console.log('Keeping latest plans:');
    for (const row of result.rows) {
      console.log(`  ${row.id}: ${row.name} | status=${row.status} active=${row.is_active}`);
    }

    // Delete all other plans (duplicates)
    const deleteResult = await db.query(
      `DELETE FROM plans
       WHERE id NOT IN (
         SELECT MAX(id) FROM plans GROUP BY name
       )
       RETURNING id, name`
    );
    console.log(`\nDeleted ${deleteResult.rowCount} duplicate plans.`);

    // Show final state
    const final = await db.query(
      'SELECT id, name, slug, price, duration_days, max_devices, status, is_active, is_visible FROM plans ORDER BY sort_order ASC, id ASC'
    );
    console.log('\nFinal plans:');
    for (const row of final.rows) {
      console.log(`  ${row.id}: ${row.name} | ₹${row.price} | ${row.duration_days}d | ${row.max_devices} device(s) | status=${row.status} active=${row.is_active} visible=${row.is_visible}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

cleanup();

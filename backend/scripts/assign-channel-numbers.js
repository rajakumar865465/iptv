#!/usr/bin/env node
/**
 * assign-channel-numbers.js
 * Assigns permanent channel numbers + genre to any channels missing one.
 * Idempotent: only fills channel_number IS NULL, existing numbers never change.
 *
 * Usage:
 *   node scripts/assign-channel-numbers.js
 *   npm run assign-numbers
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../src/config/db');
const { assignChannelNumbers } = require('../src/utils/channelNumbering');

async function main() {
  const isReset = process.argv.includes('--reset') || process.argv.includes('--renumber-all');
  if (isReset) {
    console.log('[assign-numbers] --reset specified: Sequentially renumbering all channels starting from 1...');
    await db.query(`
      BEGIN;
      UPDATE channels SET channel_number = NULL;

      WITH ranked_visible AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS seq
        FROM channels
        WHERE is_visible_app = true AND status = 'active'
      )
      UPDATE channels c
      SET channel_number = ranked_visible.seq
      FROM ranked_visible
      WHERE c.id = ranked_visible.id;

      WITH max_seq AS (
        SELECT COALESCE(MAX(channel_number), 0) AS max_num FROM channels
      ),
      ranked_remaining AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) + (SELECT max_num FROM max_seq) AS seq
        FROM channels
        WHERE channel_number IS NULL
      )
      UPDATE channels c
      SET channel_number = ranked_remaining.seq
      FROM ranked_remaining
      WHERE c.id = ranked_remaining.id;

      COMMIT;
    `);
    console.log('[assign-numbers] Successfully renumbered all channels sequentially (1, 2, 3...).');
  }

  console.log('[assign-numbers] Assigning permanent channel numbers...');
  const { assigned, perGenre } = await assignChannelNumbers(db);

  console.log(`[assign-numbers] Assigned ${assigned} new number(s).`);
  if (assigned > 0) {
    console.table(perGenre);
  }

  // Verification snapshot: lowest numbers per catalog.
  const sample = await db.query(`
    SELECT channel_number, genre, name
    FROM channels
    WHERE channel_number IS NOT NULL
    ORDER BY channel_number ASC
    LIMIT 20
  `);
  console.log('\n[assign-numbers] Lowest 20 numbers:');
  console.table(sample.rows.map(r => ({
    number: r.channel_number,
    genre: r.genre,
    name: (r.name || '').substring(0, 34),
  })));

  const dupes = await db.query(`
    SELECT channel_number, COUNT(*) AS n
    FROM channels
    WHERE channel_number IS NOT NULL
    GROUP BY channel_number
    HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length > 0) {
    console.error(`[assign-numbers] WARNING: ${dupes.rows.length} duplicate number(s) found!`);
  } else {
    console.log('[assign-numbers] No duplicate numbers. ✓');
  }

  await db.pool.end();
  console.log('[assign-numbers] Done.');
}

main().catch(err => {
  console.error('[assign-numbers] Error:', err.message);
  process.exit(1);
});

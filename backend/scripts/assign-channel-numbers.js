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
  console.log('[assign-numbers] Assigning permanent channel numbers...');
  const { assigned, perGenre, spilled } = await assignChannelNumbers(db);

  console.log(`[assign-numbers] Assigned ${assigned} new number(s).`);
  if (assigned > 0) {
    console.table(perGenre);
  }
  if (spilled > 0) {
    console.warn(`[assign-numbers] ${spilled} channel(s) used the 9000+ spill pool (a genre block exceeded 99).`);
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

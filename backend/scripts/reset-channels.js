/**
 * Reset Channels Script
 * Clears favorites, watch_history, and channels tables.
 * Optionally re-seeds Indian categories.
 * Does NOT delete users, licenses, or payments.
 * Usage: node scripts/reset-channels.js
 */

require('dotenv').config();
const db = require('../src/config/db');

const INDIAN_CATEGORIES = [
  { name: 'Doordarshan', sort_order: 1 },
  { name: 'Hindi News', sort_order: 2 },
  { name: 'English News', sort_order: 3 },
  { name: 'Bengali', sort_order: 4 },
  { name: 'Hindi Entertainment', sort_order: 5 },
  { name: 'Hindi Movies', sort_order: 6 },
  { name: 'Sports', sort_order: 7 },
  { name: 'Music', sort_order: 8 },
  { name: 'Kids', sort_order: 9 },
  { name: 'Devotional', sort_order: 10 },
  { name: 'Education', sort_order: 11 },
  { name: 'Tamil', sort_order: 12 },
  { name: 'Telugu', sort_order: 13 },
  { name: 'Malayalam', sort_order: 14 },
  { name: 'Kannada', sort_order: 15 },
  { name: 'Marathi', sort_order: 16 },
  { name: 'Punjabi', sort_order: 17 },
  { name: 'Gujarati', sort_order: 18 },
  { name: 'Odia', sort_order: 19 },
  { name: 'Assamese', sort_order: 20 },
  { name: 'Urdu', sort_order: 21 },
  { name: 'Business News', sort_order: 22 },
  { name: 'International News', sort_order: 23 },
];

async function resetChannels() {
  console.log('=== Reset Channels Script ===');
  console.log('WARNING: This will delete ALL channel data, favorites, and watch history.');
  console.log('Users, licenses, and payments will NOT be affected.\n');

  try {
    // 1. Clear watch_history (references channels)
    console.log('Clearing watch_history...');
    await db.query('DELETE FROM watch_history');
    console.log('✓ watch_history cleared');

    // 2. Clear favorites (references channels)
    console.log('Clearing favorites...');
    await db.query('DELETE FROM favorites');
    console.log('✓ favorites cleared');

    // 3. Clear channels
    console.log('Clearing channels...');
    await db.query('DELETE FROM channels');
    console.log('✓ channels cleared');

    // 4. Clear categories and re-seed Indian categories
    console.log('Clearing categories...');
    await db.query('DELETE FROM categories');
    console.log('✓ categories cleared');

    console.log('\nSeeding Indian categories...');
    for (const cat of INDIAN_CATEGORIES) {
      await db.query(
        `INSERT INTO categories (name, icon_url, status, sort_order)
         VALUES ($1, '', 'active', $2)`,
        [cat.name, cat.sort_order]
      );
      console.log(`  ✓ ${cat.name}`);
    }

    console.log('\nEnsuring unique index on channels(source_channel_id, source)...');
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_source_channel_id
      ON channels(source_channel_id, source)
      WHERE source_channel_id IS NOT NULL
    `);
    console.log('✓ Index ready');

    console.log('\n✅ Reset complete!');
    console.log('Next steps:');
    console.log('  node scripts/seed-indian-channels.js');
    console.log('  node scripts/import-iptv-org.js');
    console.log('  node scripts/check-streams.js');
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

resetChannels();

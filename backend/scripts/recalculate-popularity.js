#!/usr/bin/env node
/**
 * recalculate-popularity.js
 * Recalculates popularity_score for all channels based on:
 *   (watch_count * 3) + (favorite_count * 5) + featured_bonus(50) + recent_bonus
 *
 * Usage:
 *   node scripts/recalculate-popularity.js
 *   node scripts/recalculate-popularity.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../src/config/db');

const DRY_RUN = process.argv.includes('--dry-run');

async function recalculate() {
  console.log(`[popularity] Starting recalculation${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  // Step 1: Update watch_count from watch_history
  if (!DRY_RUN) {
    await db.query(`
      UPDATE channels c
      SET watch_count = COALESCE((
        SELECT COUNT(*) FROM watch_history wh WHERE wh.channel_id = c.id
      ), 0)
    `);
    console.log('[popularity] watch_count updated from watch_history');
  }

  // Step 2: Update favorite_count from favorites
  if (!DRY_RUN) {
    await db.query(`
      UPDATE channels c
      SET favorite_count = COALESCE((
        SELECT COUNT(*) FROM favorites f WHERE f.channel_id = c.id
      ), 0)
    `);
    console.log('[popularity] favorite_count updated from favorites');
  }

  // Step 3: Recent bonus — channels watched in last 7 days get a +30 boost
  if (!DRY_RUN) {
    await db.query(`
      UPDATE channels c
      SET popularity_score = (
        (COALESCE(c.watch_count, 0) * 3)
        + (COALESCE(c.favorite_count, 0) * 5)
        + CASE WHEN c.is_featured = true THEN 50 ELSE 0 END
        + CASE WHEN EXISTS (
            SELECT 1 FROM watch_history wh
            WHERE wh.channel_id = c.id
              AND wh.watched_at > NOW() - INTERVAL '7 days'
          ) THEN 30 ELSE 0 END
      )
    `);
    console.log('[popularity] popularity_score recalculated');
  }

  // Step 4: Mark is_popular for channels with score > 0 or is_featured
  if (!DRY_RUN) {
    const res = await db.query(`
      UPDATE channels
      SET is_popular = true
      WHERE popularity_score > 0 OR is_featured = true
      RETURNING id
    `);
    console.log(`[popularity] Marked ${res.rowCount} channels as popular`);
  }

  // Step 5: Show top 20 channels for verification
  const topRes = await db.query(`
    SELECT id, name, watch_count, favorite_count, popularity_score, is_featured, is_popular
    FROM channels
    WHERE status = 'active'
    ORDER BY popularity_score DESC NULLS LAST
    LIMIT 20
  `);

  console.log('\n[popularity] Top 20 channels by popularity:');
  console.table(topRes.rows.map(r => ({
    id: r.id,
    name: r.name.substring(0, 30),
    watches: r.watch_count,
    favs: r.favorite_count,
    score: r.popularity_score,
    featured: r.is_featured,
    popular: r.is_popular,
  })));

  await db.pool.end();
  console.log('[popularity] Done.');
}

recalculate().catch(err => {
  console.error('[popularity] Error:', err.message);
  process.exit(1);
});

/**
 * Category Cleanup Script
 * =======================
 * 1. Hide empty categories (0 visible channels)
 * 2. Merge duplicate categories (e.g., Assamese -> Assamese / North East)
 * 3. Move channels from duplicate to canonical categories
 * 4. Recalculate channel counts for public visibility
 * 5. Output cleanup report
 */

const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function getVisibleChannelCount(categoryId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM channels
     WHERE category_id = $1
       AND status = 'active'
       AND stream_url IS NOT NULL
       AND stream_url != ''
       AND merged_into_channel_id IS NULL`,
    [categoryId]
  );
  return result.rows[0].count;
}

async function main() {
  console.log('Starting category cleanup...\n');

  const report = {
    timestamp: new Date().toISOString(),
    hiddenEmptyCategories: [],
    mergedCategories: [],
    movedChannels: [],
    finalCategoryCounts: [],
  };

  // Step 1: Hide empty categories
  console.log('Step 1: Hiding empty categories...');
  const catResult = await db.query(`SELECT id, name FROM categories WHERE status = 'active'`);
  const categories = catResult.rows;

  for (const cat of categories) {
    const count = await getVisibleChannelCount(cat.id);
    if (count === 0) {
      await db.query(
        'UPDATE categories SET is_visible_public = false WHERE id = $1',
        [cat.id]
      );
      report.hiddenEmptyCategories.push({ id: cat.id, name: cat.name });
      console.log(`  Hidden: "${cat.name}" (0 visible channels)`);
    } else {
      // Make sure non-empty categories are visible
      await db.query(
        'UPDATE categories SET is_visible_public = true WHERE id = $1',
        [cat.id]
      );
    }
  }

  // Step 2: Merge duplicate categories
  console.log('\nStep 2: Merging duplicate categories...');
  const duplicates = [
    { from: 'Assamese', to: 'Assamese / North East' },
    // Add more as needed
  ];

  for (const dup of duplicates) {
    const fromRes = await db.query(`SELECT id FROM categories WHERE name = $1`, [dup.from]);
    const toRes = await db.query(`SELECT id FROM categories WHERE name = $1`, [dup.to]);

    if (fromRes.rows.length > 0 && toRes.rows.length > 0) {
      const fromId = fromRes.rows[0].id;
      const toId = toRes.rows[0].id;

      const moveResult = await db.query(
        'UPDATE channels SET category_id = $1 WHERE category_id = $2 AND status = \'active\' RETURNING id',
        [toId, fromId]
      );

      if (moveResult.rows.length > 0) {
        report.movedChannels.push(...moveResult.rows.map(r => ({
          channelId: r.id,
          from: dup.from,
          to: dup.to,
        })));
      }

      // Hide the merged (duplicate) category
      await db.query(
        'UPDATE categories SET is_visible_public = false WHERE id = $1',
        [fromId]
      );

      report.mergedCategories.push({ from: dup.from, to: dup.to, movedCount: moveResult.rows.length });
      console.log(`  Merged: "${dup.from}" -> "${dup.to}" (${moveResult.rows.length} channels)`);
    }
  }

  // Step 3: Recalculate and report final counts
  console.log('\nStep 3: Recalculating final category counts...');
  const finalRes = await db.query(
    `SELECT cat.id, cat.name, cat.is_visible_public, COUNT(c.id) AS channel_count
     FROM categories cat
     LEFT JOIN channels c ON c.category_id = cat.id
       AND c.status = 'active'
       AND c.stream_url IS NOT NULL
       AND c.stream_url != ''
       AND c.merged_into_channel_id IS NULL
     GROUP BY cat.id
     ORDER BY cat.sort_order ASC, cat.name ASC`
  );

  report.finalCategoryCounts = finalRes.rows.map(r => ({
    id: r.id,
    name: r.name,
    visible: r.is_visible_public,
    channel_count: parseInt(r.channel_count, 10),
  }));

  const totalVisible = report.finalCategoryCounts.filter(c => c.channel_count > 0).length;
  console.log(`\nFinal result: ${totalVisible} categories with visible channels`);

  // Step 4: Write report
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'category-cleanup-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(`\nReport written to: reports/category-cleanup-report.json`);

  // Summary table
  console.log('\n--- Final Category Counts ---');
  const visible = report.finalCategoryCounts.filter(c => c.channel_count > 0);
  for (const c of report.finalCategoryCounts) {
    const status = c.channel_count > 0 ? `✅ ${c.channel_count} channels` : '❌ 0 channels (hidden)';
    console.log(`  ${c.name.padEnd(25)} ${status}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });

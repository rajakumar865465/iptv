/**
 * dedupe-channels.js
 * Finds duplicate channel rows (same canonical name + language + category),
 * merges their streams into one master channel, migrates favorites/watch-history,
 * and marks duplicates as status='merged'.
 *
 * Safe to re-run — uses idempotent logic throughout.
 *
 * Usage:
 *   node scripts/dedupe-channels.js             — full merge
 *   node scripts/dedupe-channels.js --dry-run   — show what would be merged
 *   node scripts/dedupe-channels.js --report    — print report only
 */

'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const fs   = require('fs');
const path = require('path');
const db   = require('../src/config/db');

const REPORT_DIR = path.join(__dirname, '..', 'reports');
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REPORT_ONLY = args.includes('--report');

// ─── Canonical name normalisation ─────────────────────────────────────────
// Must match the SQL logic in migration 012 exactly.
function canonicalName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')                          // remove (anything)
    .replace(/\s*\b(hd|sd|fhd|uhd|4k)\b\s*/gi, ' ')           // quality labels
    .replace(/\s*\b(1080p?|720p?|576p?|480p?|360p?|240p?)\b\s*/gi, ' ') // resolutions
    .replace(/\s*\b(backup|source\s*\d*|live|channel)\b\s*/gi, ' ')      // suffixes
    .replace(/\s+/g, ' ')
    .trim();
}

// Quality preference score — lower = better (for tie-breaking master selection)
function qualityScore(quality) {
  const q = (quality || '').toLowerCase();
  if (q.includes('1080') || q.includes('fhd')) return 1;
  if (q.includes('720')  || q === 'hd')        return 2;
  if (q.includes('576'))                         return 3;
  if (q.includes('480'))                         return 4;
  if (q === 'sd')                                return 5;
  return 6; // auto/unknown
}

// Pick best master from a group:
// 1. Prefer channels with active/online health
// 2. Prefer better logo
// 3. Prefer seeded channels (source='indian-seed') over raw imports
// 4. Prefer better quality
function pickMaster(channels) {
  return channels.sort((a, b) => {
    // online > unknown > offline > merged
    const hOrder = { online: 0, unknown: 1, unstable: 2, offline: 3, merged: 9 };
    const ha = hOrder[a.health_status] ?? 5;
    const hb = hOrder[b.health_status] ?? 5;
    if (ha !== hb) return ha - hb;

    // seeded source wins
    const sa = a.source === 'indian-seed' ? 0 : 1;
    const sb = b.source === 'indian-seed' ? 0 : 1;
    if (sa !== sb) return sa - sb;

    // has logo
    const la = a.logo_url ? 0 : 1;
    const lb = b.logo_url ? 0 : 1;
    if (la !== lb) return la - lb;

    // quality
    return qualityScore(a.quality) - qualityScore(b.quality);
  })[0];
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Channel Deduplication Engine                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  if (DRY_RUN)      console.log('  MODE: DRY RUN (no DB changes)\n');
  else if (REPORT_ONLY) console.log('  MODE: REPORT ONLY\n');

  // ── Step 0: Ensure schema columns exist ──────────────────────────────────
  await db.query(`
    ALTER TABLE channels
      ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS merged_into_channel_id INTEGER;
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_channels_canonical_name ON channels(canonical_name)`);

  // ── Step 1: Backfill canonical_name for all channels ─────────────────────
  console.log('Backfilling canonical_name ...');
  const allChRes = await db.query(
    `SELECT id, name FROM channels WHERE canonical_name IS NULL OR canonical_name = ''`
  );
  for (const row of allChRes.rows) {
    const cn = canonicalName(row.name);
    await db.query(`UPDATE channels SET canonical_name = $1 WHERE id = $2`, [cn, row.id]);
  }
  console.log(`  Backfilled ${allChRes.rows.length} channels\n`);

  // ── Step 2: Find duplicate groups ────────────────────────────────────────
  console.log('Finding duplicate groups ...');
  const { rows: dupGroups } = await db.query(`
    SELECT canonical_name,
           COALESCE(language, 'Unknown')          AS language,
           COALESCE(category_id::text, 'none')    AS cat_key,
           COUNT(*)                               AS cnt,
           ARRAY_AGG(id ORDER BY id)              AS ids
    FROM channels
    WHERE status != 'merged'
      AND canonical_name IS NOT NULL
      AND canonical_name != ''
    GROUP BY canonical_name, COALESCE(language,'Unknown'), COALESCE(category_id::text,'none')
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, canonical_name
  `);

  console.log(`  Found ${dupGroups.length} duplicate groups\n`);

  if (dupGroups.length === 0) {
    console.log('No duplicates found. Database is clean ✓');
    await printReport(0, 0, 0, 0);
    await db.pool.end();
    return;
  }

  // Show top duplicates
  console.log('  Top duplicate groups:');
  dupGroups.slice(0, 20).forEach(g => {
    console.log(`    "${g.canonical_name}" (${g.language}) — ${g.cnt} copies, ids: [${g.ids.join(', ')}]`);
  });
  console.log('');

  if (REPORT_ONLY) {
    await printReport(dupGroups.length, 0, 0, 0);
    await db.pool.end();
    return;
  }

  // ── Step 3: Merge each group ───────────────────────────────────────────
  let groupsMerged = 0;
  let streamsConsolidated = 0;
  let channelsMarkedMerged = 0;

  for (const group of dupGroups) {
    const { ids } = group;

    // Load full channel rows
    const { rows: channelRows } = await db.query(
      `SELECT id, name, canonical_name, language, category_id, logo_url, local_logo_url,
              stream_url, quality, health_status, health_score, source, status, sort_order,
              is_featured, is_premium
       FROM channels WHERE id = ANY($1)`,
      [ids]
    );

    if (channelRows.length < 2) continue;

    const master = pickMaster(channelRows.filter(c => c.status !== 'merged'));
    const duplicates = channelRows.filter(c => c.id !== master.id);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] MASTER: [${master.id}] "${master.name}" (${master.health_status})`);
      duplicates.forEach(d => console.log(`    MERGE: [${d.id}] "${d.name}" → master`));
      groupsMerged++;
      continue;
    }

    // 3a. Ensure channel_streams table has the master's own stream_url
    if (master.stream_url && master.stream_url.trim()) {
      await db.query(`
        INSERT INTO channel_streams (channel_id, stream_url, quality, priority, source_name, health_status)
        VALUES ($1, $2, $3, 1, 'original', 'unknown')
        ON CONFLICT (channel_id, stream_url) DO NOTHING
      `, [master.id, master.stream_url, master.quality || 'SD']);
    }

    for (const dup of duplicates) {
      // 3b. Move dup's stream_url into master's channel_streams
      if (dup.stream_url && dup.stream_url.trim()) {
        const inserted = await db.query(`
          INSERT INTO channel_streams
            (channel_id, stream_url, quality, priority, source_name, user_agent, health_status)
          SELECT $1, stream_url, quality, priority, source_name, user_agent, health_status
          FROM channel_streams
          WHERE channel_id = $2
          ON CONFLICT (channel_id, stream_url) DO NOTHING
        `, [master.id, dup.id]);
        // Also insert the dup's own stream_url directly
        await db.query(`
          INSERT INTO channel_streams (channel_id, stream_url, quality, priority, source_name, health_status)
          VALUES ($1, $2, $3, 2, 'merged_duplicate', 'unknown')
          ON CONFLICT (channel_id, stream_url) DO NOTHING
        `, [master.id, dup.stream_url, dup.quality || 'SD']);
        streamsConsolidated++;
      }

      // 3c. Migrate favorites from dup → master (avoid duplicate favorites)
      await db.query(`
        UPDATE favorites SET channel_id = $1
        WHERE channel_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM favorites f2 WHERE f2.user_id = favorites.user_id AND f2.channel_id = $1
          )
      `, [master.id, dup.id]);
      // Delete unmovable favorites (duplicate user+channel combinations)
      await db.query(`DELETE FROM favorites WHERE channel_id = $1`, [dup.id]);

      // 3d. Migrate watch history
      await db.query(`
        UPDATE watch_history SET channel_id = $1 WHERE channel_id = $2
      `, [master.id, dup.id]);

      // 3e. Update master's logo if it has no logo and dup does
      if (!master.logo_url && dup.logo_url) {
        await db.query(`UPDATE channels SET logo_url = $1 WHERE id = $2`, [dup.logo_url, master.id]);
        master.logo_url = dup.logo_url;
      }

      // 3f. Mark dup as merged
      await db.query(`
        UPDATE channels
        SET status = 'merged',
            health_status = 'merged',
            merged_into_channel_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [master.id, dup.id]);

      channelsMarkedMerged++;
    }

    // 3g. Update master's has_backup_streams flag
    const streamCount = await db.query(
      `SELECT COUNT(*) cnt FROM channel_streams WHERE channel_id = $1`, [master.id]
    );
    await db.query(
      `UPDATE channels SET has_backup_streams = $1 WHERE id = $2`,
      [parseInt(streamCount.rows[0].cnt, 10) > 1, master.id]
    );

    groupsMerged++;
    process.stdout.write(`  ✓ Merged group "${group.canonical_name}" (${duplicates.length} dupes)\n`);
  }

  console.log(`\nDone — Groups merged: ${groupsMerged}, Streams consolidated: ${streamsConsolidated}, Channels marked merged: ${channelsMarkedMerged}`);
  await printReport(dupGroups.length, groupsMerged, streamsConsolidated, channelsMarkedMerged);
  await db.pool.end();
  process.exit(0);
}

async function printReport(dupGroupsFound, groupsMerged, streamsConsolidated, channelsMarkedMerged) {
  const [totalRes, activeRes, mergedRes, onlineRes] = await Promise.all([
    db.query(`SELECT COUNT(*) c FROM channels`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status = 'active'`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status = 'merged'`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE status = 'active' AND health_status = 'online'`),
  ]);

  // Find remaining duplicates after merge
  const { rows: remaining } = await db.query(`
    SELECT canonical_name, COUNT(*) cnt
    FROM channels
    WHERE status != 'merged' AND canonical_name IS NOT NULL AND canonical_name != ''
    GROUP BY canonical_name HAVING COUNT(*) > 1
    ORDER BY cnt DESC LIMIT 20
  `);

  const report = {
    generated_at:          new Date().toISOString(),
    dry_run:               DRY_RUN,
    duplicate_groups_found: dupGroupsFound,
    groups_merged:          groupsMerged,
    streams_consolidated:   streamsConsolidated,
    channels_marked_merged: channelsMarkedMerged,
    total_channels:         parseInt(totalRes.rows[0].c, 10),
    active_channels:        parseInt(activeRes.rows[0].c, 10),
    merged_channels:        parseInt(mergedRes.rows[0].c, 10),
    online_channels:        parseInt(onlineRes.rows[0].c, 10),
    remaining_duplicates:   remaining.map(r => ({ name: r.canonical_name, count: parseInt(r.cnt,10) })),
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'channel-dedupe-report.json'), JSON.stringify(report, null, 2));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Deduplication Report                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Duplicate groups found:   ${report.duplicate_groups_found}`);
  console.log(`  Groups merged:            ${report.groups_merged}`);
  console.log(`  Streams consolidated:     ${report.streams_consolidated}`);
  console.log(`  Channels marked merged:   ${report.channels_marked_merged}`);
  console.log(`  Total channels in DB:     ${report.total_channels}`);
  console.log(`  Active unique channels:   ${report.active_channels}`);
  console.log(`  Online channels:          ${report.online_channels}`);
  console.log(`  Merged (hidden) channels: ${report.merged_channels}`);
  if (report.remaining_duplicates.length > 0) {
    console.log(`\n  ⚠ Still has duplicates (${report.remaining_duplicates.length} groups):`);
    report.remaining_duplicates.slice(0, 10).forEach(r => console.log(`    "${r.name}" — ${r.count} copies`));
  } else {
    console.log('\n  ✓ No remaining duplicates!');
  }
  console.log('\n  Report saved → reports/channel-dedupe-report.json');
}

main().catch(err => {
  console.error('Dedupe failed:', err);
  process.exit(1);
});

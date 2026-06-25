/**
 * activate-working-channels.js
 * After deep stream check:
 *  - Channels with at least one online stream → status=active, health_status=online
 *  - Channels with only unstable → status=active, health_status=unstable
 *  - Channels with no working stream → status=offline, health_status=offline
 *  - Paid channels with no legal source → status=inactive, health_reason=requires_licensed_source
 *
 * Usage: node scripts/activate-working-channels.js
 */

'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '..', 'reports');

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Activate Working Indian Channels                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Activate channels that have at least one online stream
  //    Set active_stream_id and stream_url to the BEST stream:
  //    priority: health_score DESC, then quality preference 720p>HD>SD>1080p
  const { rowCount: activated } = await db.query(`
    UPDATE channels SET
      status        = 'active',
      health_status = 'online',
      active_stream_id = sub.best_stream_id,
      stream_url    = sub.best_url,
      quality       = sub.best_quality,
      health_score  = sub.best_score,
      updated_at    = NOW()
    FROM (
      SELECT DISTINCT ON (channel_id)
        channel_id,
        id   AS best_stream_id,
        stream_url  AS best_url,
        quality     AS best_quality,
        health_score AS best_score
      FROM channel_streams
      WHERE health_status = 'online'
      ORDER BY channel_id,
               health_score DESC,
               CASE quality
                 WHEN '720p' THEN 1 WHEN 'HD'   THEN 2
                 WHEN 'SD'   THEN 3 WHEN '1080p' THEN 4
                 ELSE 5
               END ASC,
               fail_count ASC,
               last_success_at DESC NULLS LAST
    ) sub
    WHERE channels.id = sub.channel_id
      AND channels.status NOT IN ('merged','duplicate')
  `);
  console.log(`✓ Activated online channels:   ${activated}`);

  // 2. Unstable channels (has streams but none fully online)
  const { rowCount: unstabled } = await db.query(`
    UPDATE channels SET
      status       = 'active',
      health_status = 'unstable',
      updated_at   = NOW()
    WHERE health_status != 'online'
      AND status NOT IN ('merged','duplicate')
      AND id IN (
        SELECT DISTINCT channel_id FROM channel_streams WHERE health_status = 'unstable'
      ) AND id NOT IN (
        SELECT DISTINCT channel_id FROM channel_streams WHERE health_status = 'online'
      ) AND status IN ('pending_check','offline','unknown')
  `);
  console.log(`~ Activated unstable channels: ${unstabled}`);

  // 3. Mark truly offline channels (don't touch merged ones)
  const { rowCount: offlined } = await db.query(`
    UPDATE channels SET
      status       = 'offline',
      health_status = 'offline',
      updated_at   = NOW()
    WHERE status = 'pending_check'
      AND status NOT IN ('merged','duplicate')
      AND id NOT IN (
        SELECT DISTINCT channel_id FROM channel_streams
        WHERE health_status IN ('online','unstable')
      )
  `);
  console.log(`✗ Marked offline channels:     ${offlined}`);

  // 4. Paid channels with no licensed source
  const { rowCount: inactivated } = await db.query(`
    UPDATE channels SET
      status       = 'inactive',
      health_status = 'offline',
      health_reason = 'requires_licensed_source',
      updated_at   = NOW()
    WHERE is_paid = true
    AND status NOT IN ('active')
    AND (stream_url IS NULL OR stream_url = '')
  `);
  console.log(`⊘ Paid/no-source channels:     ${inactivated}`);

  // 5. Set has_backup_streams flag
  await db.query(`
    UPDATE channels SET has_backup_streams = (
      SELECT COUNT(*) > 1 FROM channel_streams WHERE channel_id = channels.id
    )
  `);

  // Summary counts
  const counts = await db.query(`
    SELECT status, health_status, COUNT(*) cnt
    FROM channels
    WHERE country = 'IN'
    GROUP BY status, health_status
    ORDER BY cnt DESC
  `);

  const totalRes = await db.query(`SELECT COUNT(*) c FROM channels WHERE country='IN'`);
  const onlineRes= await db.query(`SELECT COUNT(*) c FROM channels WHERE country='IN' AND status='active' AND health_status='online'`);
  const appShowsRes= await db.query(`SELECT COUNT(*) c FROM channels WHERE country='IN' AND status='active' AND health_status='online' AND stream_url IS NOT NULL`);

  console.log('\n─── Channel Status Summary ───────────────────────────');
  counts.rows.forEach(r => console.log(`  ${r.status} / ${r.health_status}: ${r.cnt}`));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Final Result                                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total Indian channels:        ${totalRes.rows[0].c}`);
  console.log(`  Online (will show in app):    ${onlineRes.rows[0].c}`);
  console.log(`  Ready for users:              ${appShowsRes.rows[0].c}`);

  // Save report
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    activated, unstabled, offlined, inactivated,
    total_indian:   parseInt(totalRes.rows[0].c, 10),
    online:         parseInt(onlineRes.rows[0].c, 10),
    shown_in_app:   parseInt(appShowsRes.rows[0].c, 10),
    by_status:      counts.rows.map(r => ({ status: r.status, health_status: r.health_status, count: parseInt(r.cnt,10) })),
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'activation-report.json'), JSON.stringify(report, null, 2));
  console.log('\n  Report saved → reports/activation-report.json');

  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Activation failed:', err);
  process.exit(1);
});

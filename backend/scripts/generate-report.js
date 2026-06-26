/**
 * generate-report.js
 * Generates indian-stream-report.json and prints a terminal summary.
 * Run after import + check-streams-deep + activate-working-channels.
 *
 * Usage: node scripts/generate-report.js
 */
'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const fs   = require('fs');
const path = require('path');
const db   = require('../src/config/db');

const REPORT_DIR = path.join(__dirname, '..', 'reports');

async function main() {
  const [total, catBreakdown, langBreakdown, healthBreakdown, topFails, appReady] = await Promise.all([
    db.query(`SELECT COUNT(*) c FROM channels WHERE country='IN'`),
    db.query(`SELECT cat.name, COUNT(ch.id) cnt FROM channels ch LEFT JOIN categories cat ON ch.category_id=cat.id WHERE ch.country='IN' GROUP BY cat.name ORDER BY cnt DESC`),
    db.query(`SELECT language, COUNT(*) cnt FROM channels WHERE country='IN' GROUP BY language ORDER BY cnt DESC LIMIT 20`),
    db.query(`SELECT health_status, COUNT(*) cnt FROM channels WHERE country='IN' GROUP BY health_status ORDER BY cnt DESC`),
    db.query(`SELECT cs.health_reason, COUNT(*) cnt FROM channel_streams cs JOIN channels c ON cs.channel_id=c.id WHERE c.country='IN' AND cs.health_status='offline' GROUP BY cs.health_reason ORDER BY cnt DESC LIMIT 15`),
    db.query(`SELECT COUNT(*) c FROM channels WHERE country='IN' AND status='active' AND health_status='online' AND stream_url IS NOT NULL`),
  ]);

  const healthMap = Object.fromEntries(healthBreakdown.rows.map(r => [r.health_status||'unknown', parseInt(r.cnt,10)]));

  const report = {
    generated_at:    new Date().toISOString(),
    total_indian:    parseInt(total.rows[0].c, 10),
    working_online:  healthMap['online']   || 0,
    unstable:        healthMap['unstable'] || 0,
    offline:         healthMap['offline']  || 0,
    unknown:         (healthMap['unknown'] || 0) + (healthMap['pending_check'] || 0),
    shown_in_app:    parseInt(appReady.rows[0].c, 10),
    categories:      Object.fromEntries(catBreakdown.rows.map(r => [r.name||'Unknown', parseInt(r.cnt,10)])),
    languages:       Object.fromEntries(langBreakdown.rows.map(r => [r.language||'Unknown', parseInt(r.cnt,10)])),
    top_failure_reasons: Object.fromEntries(topFails.rows.map(r => [r.health_reason||'unknown', parseInt(r.cnt,10)])),
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outPath = path.join(REPORT_DIR, 'indian-stream-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Indian IPTV Stream Report                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total Indian channels:        ${report.total_indian}`);
  console.log(`  🟢 Online:                   ${report.working_online}`);
  console.log(`  🟡 Unstable:                 ${report.unstable}`);
  console.log(`  🔴 Offline:                  ${report.offline}`);
  console.log(`  ⚪ Unknown/Pending:           ${report.unknown}`);
  console.log(`  📱 Shown in app (users):      ${report.shown_in_app}`);

  console.log('\n  Category breakdown (top 15):');
  Object.entries(report.categories).slice(0,15).forEach(([k,v]) => console.log(`    ${(k+'                    ').slice(0,24)} ${v}`));

  console.log('\n  Language breakdown:');
  Object.entries(report.languages).slice(0,12).forEach(([k,v]) => console.log(`    ${(k+'              ').slice(0,16)} ${v}`));

  console.log('\n  Top failure reasons:');
  Object.entries(report.top_failure_reasons).slice(0,8).forEach(([k,v]) => console.log(`    ${k}: ${v}`));

  console.log(`\n  Full report → reports/indian-stream-report.json\n`);

  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Report failed:', err);
  process.exit(1);
});

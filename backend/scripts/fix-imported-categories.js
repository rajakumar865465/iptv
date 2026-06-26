'use strict';
/**
 * fix-imported-categories.js
 * ──────────────────────────────────────────────────────────────────────────
 * Corrects wrong category/language assignments on channels imported from
 * working_iptv.m3u where smartCategory mapped them incorrectly:
 *   - Fox News / Sky News / CBS News / etc. → International News (not Hindi News)
 *   - Hallmark Movies / Lifetime / Starz → English Movies (not Hindi Movies)
 *   - PBS Kids variants → Kids (not International News)
 *   - English-group channels → language = English (not Hindi)
 *
 * Usage:
 *   node scripts/fix-imported-categories.js
 *   node scripts/fix-imported-categories.js --dry-run
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db   = require('../src/config/db');
const args = process.argv.slice(2);
const DRY  = args.includes('--dry-run');

async function getCatId(name) {
  const r = await db.query('SELECT id FROM categories WHERE name=$1', [name]);
  if (r.rows.length) return r.rows[0].id;
  const ins = await db.query(
    `INSERT INTO categories (name, status, sort_order) VALUES ($1,'active',99) RETURNING id`, [name]
  );
  return ins.rows[0].id;
}

// List of [channel name ILIKE pattern, correct_category, correct_language]
const FIXES = [
  // ── International News channels wrongly set to Hindi News ────────────────
  ['fox news%',             'International News', 'English'],
  ['sky news%',             'International News', 'English'],
  ['cbs news%',             'International News', 'English'],
  ['nbc news%',             'International News', 'English'],
  ['abc news%',             'International News', 'English'],
  ['sabc news%',            'International News', 'English'],
  ['kitv%',                 'International News', 'English'],
  ['vice news%',            'International News', 'English'],
  ['nbcnews%',              'International News', 'English'],
  // ── Channels wrongly in Hindi Movies ─────────────────────────────────────
  ['hallmark movies%',      'English Movies',     'English'],
  ['lifetime movies%',      'English Movies',     'English'],
  ['starz cinema%',         'English Movies',     'English'],
  ['movie bangla%',         'Bengali',            'Bengali'],
  ['zee cinema uk%',        'Hindi Movies',       'Hindi'],
  // ── Sports wrongly categorized ────────────────────────────────────────────
  ['dazn combat%',          'Sports',             'English'],
  ['espnu%',                'Sports',             'English'],
  ['espn8%',                'Sports',             'English'],
  ['tennis channel%',       'Sports',             'English'],
  ['nba tv%',               'Sports',             'English'],
  // ── Kids wrongly in International News ───────────────────────────────────
  ['pbs kids%',             'Kids',               'English'],
  ['nickelodeon%',          'Kids',               'English'],
  ['starz kids%',           'Kids',               'English'],
  ['disney channel%',       'Kids',               'English'],
  // ── English Movies ────────────────────────────────────────────────────────
  ['hallmark channel%',     'English Movies',     'English'],
  ['showtime%',             'English Movies',     'English'],
  ['starz %',               'English Movies',     'English'],
  ['amc %',                 'English Movies',     'English'],
  ['syfy%',                 'International News', 'English'],
  ['comedy central%',       'International News', 'English'],
  ['bravo %',               'International News', 'English'],
  ['we tv%',                'International News', 'English'],
  // ── Music ─────────────────────────────────────────────────────────────────
  ['stingray%',             'Music',              'English'],
  ['qello concerts%',       'Music',              'English'],
  // ── Lifestyle ─────────────────────────────────────────────────────────────
  ['love nature%',          'Lifestyle / Infotainment', 'English'],
  ['national geographic%',  'Lifestyle / Infotainment', 'English'],
  ['curiosity%',            'Lifestyle / Infotainment', 'English'],
  ['documentary%',          'Lifestyle / Infotainment', 'English'],
  ['docubox%',              'Lifestyle / Infotainment', 'English'],
  ['da vinci%',             'Lifestyle / Infotainment', 'English'],
  ['cgtn documentary%',     'Lifestyle / Infotainment', 'English'],
  ['rt documentary%',       'Lifestyle / Infotainment', 'English'],
  ['pbs nature%',           'Lifestyle / Infotainment', 'English'],
  ['pbs travel%',           'Lifestyle / Infotainment', 'English'],
  ['weatherspy%',           'Lifestyle / Infotainment', 'English'],
  ['jamaica travel%',       'Lifestyle / Infotainment', 'English'],
  ['knowledge network%',    'Lifestyle / Infotainment', 'English'],
  // ── PBS ─────────────────────────────────────────────────────────────────
  ['pbs %',                 'International News', 'English'],
  ['olelo%',                'International News', 'English'],
  ['wmpt%',                 'International News', 'English'],
  ['mrvtv%',                'International News', 'English'],
  // ── Fix language for all English-Popular channels ────────────────────────
  ['dw english%',           'International News', 'English'],
  ['france 24%',            'International News', 'English'],
  ['al jazeera%',           'International News', 'English'],
  ['al-mahdi%',             'International News', 'English'],
  ['trt world%',            'International News', 'English'],
  ['bloomberg%',            'International News', 'English'],
  ['cnbc%',                 'International News', 'English'],
  ['bbc %',                 'International News', 'English'],
  ['gmtv%',                 'International News', 'English'],
  ['euronews%',             'International News', 'English'],
  ['mtv %',                 'International News', 'English'],
  ['mtv2%',                 'International News', 'English'],
  ['mtv global%',           'International News', 'English'],
  ['mtv guyana%',           'International News', 'English'],
  ['nba tv%',               'Sports',             'English'],
  ['4seven%',               'International News', 'English'],
  ['acnn%',                 'International News', 'English'],
  ['channel 4 uk%',         'International News', 'English'],
  ['channel 44%',           'International News', 'English'],
  ['cmt %',                 'International News', 'English'],
  ['filam%',                'International News', 'English'],
  ['mmtv%',                 'International News', 'English'],
  ['oxygen %',              'International News', 'English'],
  ['sabc%',                 'International News', 'English'],
  ['sumtv%',                'International News', 'English'],
  ['stories by amc%',       'International News', 'English'],
  ['all weddings%',         'International News', 'English'],
  ['vice news%',            'International News', 'English'],
  ['amcenespanol%',         'International News', 'English'],
  ['amc en%',               'International News', 'English'],
  ['amc europe%',           'International News', 'English'],
  ['amc absolute%',         'International News', 'English'],
  ['antiques roadshow%',    'International News', 'English'],
  ['dazn%',                 'Sports',             'English'],
  ['cbsn%',                 'International News', 'English'],
  ['cbs 3 omaha%',          'International News', 'English'],
  ['nbc 5 chicago%',        'International News', 'English'],
  ['sky news extra%',       'International News', 'English'],
  ['sky news weather%',     'International News', 'English'],
  ['sun tv%',               'Tamil',              'Tamil'],
];

async function main() {
  console.log(`\n✦ Fixing category/language for imported channels${DRY ? ' (DRY RUN)' : ''}\n`);
  let fixed = 0;

  for (const [pattern, catName, lang] of FIXES) {
    // Find channels matching the pattern that came from working-m3u
    const found = await db.query(
      `SELECT c.id, c.name, cat.name as current_cat, c.language
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.name ILIKE $1
         AND c.source = 'working-m3u'`,
      [pattern]
    );
    if (!found.rows.length) continue;

    const catId = DRY ? null : await getCatId(catName);

    for (const row of found.rows) {
      if (row.current_cat === catName && row.language === lang) continue; // already correct
      console.log(`  ${row.name}`);
      console.log(`    category: ${row.current_cat} → ${catName}`);
      console.log(`    language: ${row.language} → ${lang}`);
      if (!DRY) {
        await db.query(
          `UPDATE channels SET category_id=$1, language=$2, updated_at=NOW() WHERE id=$3`,
          [catId, lang, row.id]
        );
      }
      fixed++;
    }
  }

  console.log(`\n✓ Fixed ${fixed} channel(s)${DRY ? ' (dry run — nothing written)' : ''}`);
  await db.pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

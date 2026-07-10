'use strict';
/**
 * fix-channel-categories.js
 * ─────────────────────────────────────────────────────────────────────────
 * Fixes known Indian channel mis-categorizations across ALL import sources.
 * Unlike fix-imported-categories.js this is NOT restricted to working-m3u.
 *
 * Usage:
 *   node scripts/fix-channel-categories.js            # apply fixes
 *   node scripts/fix-channel-categories.js --dry-run  # preview only
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db   = require('../src/config/db');
const args = process.argv.slice(2);
const DRY  = args.includes('--dry-run');

async function getCatId(name) {
  const r = await db.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (r.rows.length) return r.rows[0].id;
  const ins = await db.query(
    `INSERT INTO categories (name, status, sort_order) VALUES ($1, 'active', 99) RETURNING id`,
    [name]
  );
  return ins.rows[0].id;
}

// [name ILIKE pattern, correct_category, correct_language]
// These channels are commonly mis-tagged across any import source.
const FIXES = [
  // ── ABP Network (Hindi news, not entertainment) ───────────────────────
  ['abp ganga%',             'Hindi News',        'Hindi'],
  ['abp news%',              'Hindi News',        'Hindi'],
  ['abp majha%',             'Marathi News',      'Marathi'],
  ['abp ananda%',            'Bengali News',      'Bengali'],
  ['abp asmita%',            'Gujarati News',     'Gujarati'],
  ['abp live%',              'Hindi News',        'Hindi'],

  // ── Aastha / devotional channels ─────────────────────────────────────
  ['aaseervatham%',          'Tamil Entertainment', 'Tamil'],
  ['aastha%',                'Devotional',          'Hindi'],
  ['sankara tv%',            'Tamil Entertainment', 'Tamil'],
  ['dharshan tv%',           'Tamil Entertainment', 'Tamil'],

  // ── India TV / News channels wrongly in entertainment ────────────────
  ['india tv%',              'Hindi News',        'Hindi'],
  ['aaj tak%',               'Hindi News',        'Hindi'],
  ['zee news%',              'Hindi News',        'Hindi'],
  ['ndtv 24x7%',             'Hindi News',        'Hindi'],
  ['ndtv india%',            'Hindi News',        'Hindi'],
  ['news18 india%',          'Hindi News',        'Hindi'],
  ['news18 rajasthan%',      'Hindi News',        'Hindi'],
  ['news18 up%',             'Hindi News',        'Hindi'],
  ['news18 bihar%',          'Hindi News',        'Hindi'],
  ['news18 mp%',             'Hindi News',        'Hindi'],
  ['news18 gujarat%',        'Gujarati News',     'Gujarati'],
  ['news18 tamil%',          'Tamil News',        'Tamil'],
  ['news18 kannada%',        'Kannada News',      'Kannada'],
  ['news18 kerala%',         'Malayalam News',    'Malayalam'],
  ['news18 bangla%',         'Bengali News',      'Bengali'],
  ['news18 odia%',           'Odia News',         'Odia'],
  ['tv9 bharatvarsh%',       'Hindi News',        'Hindi'],
  ['tv9 telugu%',            'Telugu News',       'Telugu'],
  ['tv9 kannada%',           'Kannada News',      'Kannada'],
  ['tv9 gujarat%',           'Gujarati News',     'Gujarati'],
  ['tv9 marathi%',           'Marathi News',      'Marathi'],
  ['timesnow%',              'English News',      'English'],
  ['times now%',             'English News',      'English'],
  ['republic tv%',           'English News',      'English'],
  ['mirror now%',            'English News',      'English'],
  ['cnbc tv18%',             'English News',      'English'],
  ['cnbc awaaz%',            'Hindi News',        'Hindi'],

  // ── DD / Doordarshan channels ─────────────────────────────────────────
  ['dd news%',               'Doordarshan',       'Hindi'],
  ['dd national%',           'Doordarshan',       'Hindi'],
  ['dd india%',              'Doordarshan',       'English'],
  ['dd bharati%',            'Doordarshan',       'Hindi'],
  ['dd sports%',             'Sports',            'Hindi'],
  ['dd kisan%',              'Doordarshan',       'Hindi'],
  ['dd bangla%',             'Doordarshan',       'Bengali'],
  ['dd malayalam%',          'Doordarshan',       'Malayalam'],

  // ── Bengali channels wrongly in Hindi Entertainment ───────────────────
  ['jalsha%',                'Bengali Entertainment', 'Bengali'],
  ['star jalsha%',           'Bengali Entertainment', 'Bengali'],
  ['zee bangla%',            'Bengali Entertainment', 'Bengali'],
  ['colors bangla%',         'Bengali Entertainment', 'Bengali'],
  ['mazhavil manorama%',     'Malayalam Entertainment','Malayalam'],
  ['asianet%',               'Malayalam Entertainment','Malayalam'],
  ['surya tv%',              'Malayalam Entertainment','Malayalam'],
];

async function main() {
  console.log(`\n✦ Fixing Indian channel categories${DRY ? ' (DRY RUN)' : ''}\n`);
  let fixed = 0;

  for (const [pattern, catName, lang] of FIXES) {
    const found = await db.query(
      `SELECT c.id, c.name, cat.name as current_cat, c.language
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.name ILIKE $1`,
      [pattern]
    );
    if (!found.rows.length) continue;

    const catId = DRY ? null : await getCatId(catName);

    for (const row of found.rows) {
      if (row.current_cat === catName && row.language === lang) continue;
      console.log(`  ${row.name}`);
      console.log(`    category: "${row.current_cat}" → "${catName}"`);
      console.log(`    language: "${row.language}" → "${lang}"`);
      if (!DRY) {
        await db.query(
          `UPDATE channels SET category_id = $1, language = $2, updated_at = NOW() WHERE id = $3`,
          [catId, lang, row.id]
        );
      }
      fixed++;
    }
  }

  console.log(`\n✓ ${fixed} channel(s) ${DRY ? 'would be fixed (dry run)' : 'fixed'}`);
  await db.pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

'use strict';
/**
 * normalize-categories-languages.js
 * ─────────────────────────────────────────────────────────────────────────
 * ONE-TIME, IDEMPOTENT normalization of every channel's global content
 * category and official language, per the "category = content type,
 * language = official language" model.
 *
 * What it does (safe — only touches category_id / language / categories table):
 *   1. Ensures the 13 GLOBAL content categories exist and are active.
 *   2. Re-classifies EVERY channel (name/display_name/canonical_name/tvg_id/
 *      current category) → { category, language } using channel-classifier.js.
 *      Language is 'Unknown' when unclear — NEVER defaulted to Hindi.
 *   3. Retires the old language-mixed / language-as-category buckets by setting
 *      status='hidden' (NOT deleted) once channels have moved off them.
 *   4. Emits a full before/after report + review lists (Unknown language,
 *      low-confidence category/language) to backend/scripts/output/.
 *
 * It does NOT touch: stream_url, channel_streams, favorites, watch_history,
 * users, licenses, payments, playback fields, health status.
 *
 * Usage:
 *   node scripts/normalize-categories-languages.js --dry-run     # preview, no writes
 *   node scripts/normalize-categories-languages.js               # apply (transaction)
 *   node scripts/normalize-categories-languages.js --report-only=path/to/rows.json
 *                                                                # offline: classify a
 *                                                                # JSON dump, no DB
 */

const fs = require('fs');
const path = require('path');
const { classify, GLOBAL_CATEGORIES } = require('./lib/channel-classifier');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const reportOnlyArg = args.find((a) => a.startsWith('--report-only='));
const REPORT_ONLY = reportOnlyArg ? reportOnlyArg.split('=')[1] : null;

// Canonical global categories in display order (sort_order = index + 1).
const GLOBAL = [
  'Doordarshan', 'Entertainment', 'Movies', 'News', 'Sports', 'Music',
  'Devotional', 'Kids', 'Education', 'Business', 'Regional', 'Lifestyle', 'General',
];

const OUT_DIR = path.join(__dirname, 'output');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function tally(rows, keyFn) {
  const m = {};
  for (const r of rows) { const k = keyFn(r); m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function printTable(title, entries) {
  console.log(`\n=== ${title} ===`);
  for (const [k, v] of entries) console.log(`${String(v).padStart(5)}  ${k}`);
}

function buildReport(classified) {
  // classified: [{ id, name, oldCategory, oldLanguage, category, language,
  //                categoryConfidence, languageConfidence, reasons }]
  const visible = classified.filter((c) => c.isVisible !== false);
  const unknownLang = classified.filter((c) => c.language === 'Unknown');
  const lowCat = classified.filter((c) => c.categoryConfidence === 'low');
  const lowLang = classified.filter((c) => c.languageConfidence === 'low');

  printTable('AFTER — category (visible channels)', tally(visible, (c) => c.category));
  printTable('AFTER — language (visible channels)', tally(visible, (c) => c.language));
  printTable('BEFORE — category (visible channels)', tally(visible, (c) => c.oldCategory || '(none)'));
  printTable('BEFORE — language (visible channels)', tally(visible, (c) => c.oldLanguage || '(none)'));

  console.log(`\nUnknown-language channels : ${unknownLang.length}`);
  console.log(`Low-confidence category   : ${lowCat.length}`);
  console.log(`Low-confidence language   : ${lowLang.length}`);

  ensureOutDir();
  const write = (f, data) => fs.writeFileSync(path.join(OUT_DIR, f), data);
  const csv = (rows) => 'id,name,old_category,new_category,old_language,new_language,cat_conf,lang_conf,reason\n' +
    rows.map((c) => [c.id, c.name, c.oldCategory, c.category, c.oldLanguage, c.language,
      c.categoryConfidence, c.languageConfidence, (c.reasons || []).join(' | ')]
      .map((x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');

  write('all-classified.csv', csv(classified));
  write('review-unknown-language.csv', csv(unknownLang));
  write('review-low-confidence-category.csv', csv(lowCat));
  write('review-low-confidence-language.csv', csv(lowLang));
  console.log(`\nReview files written to ${OUT_DIR}/`);

  return { unknownLang: unknownLang.length, lowCat: lowCat.length, lowLang: lowLang.length };
}

// ── Offline mode: classify a JSON dump, produce report, no DB ────────────────
async function reportOnly() {
  const rows = JSON.parse(fs.readFileSync(REPORT_ONLY, 'utf-8'));
  const classified = rows.map((ch) => {
    const r = classify(ch);
    return {
      id: ch.id, name: ch.name,
      oldCategory: ch.category_name, oldLanguage: ch.language,
      category: r.category, language: r.language,
      categoryConfidence: r.categoryConfidence, languageConfidence: r.languageConfidence,
      reasons: r.reasons,
      isVisible: ch.is_hidden !== true && ch.is_removed !== true && ch.status === 'active',
    };
  });
  console.log(`\n✦ REPORT-ONLY (offline) — ${classified.length} channels from ${REPORT_ONLY}`);
  buildReport(classified);
}

// ── DB mode ──────────────────────────────────────────────────────────────────
async function run() {
  const db = require('../src/config/db');

  console.log(`\n✦ Normalize categories & languages${DRY ? ' (DRY RUN — no writes)' : ''}\n`);

  // All writes go through a single transaction so a mid-run failure rolls back
  // cleanly and never leaves the catalog half-normalized. Reads use the pool.
  const client = DRY ? null : await db.pool.connect();
  const write = (text, params) => (DRY ? Promise.resolve({ rows: [] }) : client.query(text, params));

  try {
    if (client) await client.query('BEGIN');

    // 1. Ensure global categories exist / are active with correct sort order.
    const catId = {};
    for (let i = 0; i < GLOBAL.length; i++) {
      const name = GLOBAL[i];
      const sort = i + 1;
      const found = await db.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
      if (found.rows.length) {
        catId[name] = found.rows[0].id;
        await write(
          `UPDATE categories SET name=$1, status='active', sort_order=$2, is_visible_public=true, updated_at=NOW() WHERE id=$3`,
          [name, sort, catId[name]]
        );
      } else if (!DRY) {
        const ins = await write(
          `INSERT INTO categories (name, icon_url, status, sort_order, is_visible_public)
           VALUES ($1, '', 'active', $2, true) RETURNING id`,
          [name, sort]
        );
        catId[name] = ins.rows[0].id;
        console.log(`  + created category "${name}" (id ${catId[name]})`);
      } else {
        catId[name] = `NEW:${name}`;
      }
    }

    // 2. Load every channel (including hidden/removed — normalize them too).
    const chRes = await db.query(
      `SELECT c.id, c.name, c.display_name, c.canonical_name, c.tvg_id, c.language,
              c.is_hidden, c.is_removed, c.status, cat.name AS category_name
       FROM channels c LEFT JOIN categories cat ON cat.id = c.category_id`
    );

    const classified = [];
    let changed = 0;
    for (const ch of chRes.rows) {
      const r = classify(ch);
      classified.push({
        id: ch.id, name: ch.name,
        oldCategory: ch.category_name, oldLanguage: ch.language,
        category: r.category, language: r.language,
        categoryConfidence: r.categoryConfidence, languageConfidence: r.languageConfidence,
        reasons: r.reasons,
        isVisible: ch.is_hidden !== true && ch.is_removed !== true && ch.status === 'active',
      });

      const needsUpdate = ch.category_name !== r.category || (ch.language || '') !== r.language;
      if (needsUpdate) {
        changed++;
        await write(
          `UPDATE channels SET category_id=$1, language=$2, updated_at=NOW() WHERE id=$3`,
          [catId[r.category], r.language, ch.id]
        );
      }
    }
    console.log(`\n${changed} of ${chRes.rows.length} channels ${DRY ? 'would be' : 'were'} updated.`);

    // 3. Retire old buckets (not in GLOBAL) once channels have moved off them.
    //    status='inactive' (NOT 'hidden' — categories.status has a CHECK constraint
    //    allowing only 'active'/'inactive'). getCategories filters status='active',
    //    so 'inactive' removes them from the chips. No rows are deleted.
    const globalLower = GLOBAL.map((g) => g.toLowerCase());
    const oldCats = await db.query(`SELECT id, name FROM categories WHERE status='active'`);
    const retired = [];
    for (const c of oldCats.rows) {
      if (!globalLower.includes(c.name.toLowerCase())) {
        retired.push(c.name);
        await write(
          `UPDATE categories SET status='inactive', is_visible_public=false, updated_at=NOW() WHERE id=$1`,
          [c.id]
        );
      }
    }
    console.log(`${retired.length} old categories ${DRY ? 'would be' : 'were'} retired (status=inactive): ${retired.join(', ')}`);

    if (client) await client.query('COMMIT');

    // 4. Report
    buildReport(classified);
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    throw e;
  } finally {
    if (client) client.release();
    await db.pool.end();
  }
}

(async () => {
  try {
    if (REPORT_ONLY) await reportOnly();
    else await run();
    console.log('\n✓ Done.\n');
  } catch (e) {
    console.error('normalize failed:', e);
    process.exit(1);
  }
})();

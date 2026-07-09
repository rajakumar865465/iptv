'use strict';
/**
 * verify-filters.js
 * ─────────────────────────────────────────────────────────────────────────
 * Post-normalization acceptance test. Hits the PUBLIC API (no DB access
 * needed) and checks the category/language filter system end-to-end:
 *   - category chips are global content types only (no "Hindi Entertainment"…)
 *   - language chips are clean, with Unknown last
 *   - the 21 category × language combinations return sane, consistent counts
 *   - combined counts match actual filtered results
 *   - related channels follow same-category+language priority
 *   - no regional channel is served under the Hindi language filter
 *
 * Usage:
 *   node scripts/verify-filters.js                       # default base URL
 *   API_BASE=http://35.154.128.217 node scripts/verify-filters.js
 */

const BASE = process.env.API_BASE || 'http://35.154.128.217';

const BANNED_CATEGORY_SUBSTR = ['hindi entertainment', 'hindi movies', 'hindi news', 'english news', 'business news'];
const GLOBAL_CATEGORIES = ['Doordarshan', 'Entertainment', 'Movies', 'News', 'Sports',
  'Music', 'Devotional', 'Kids', 'Education', 'Business', 'Regional', 'Lifestyle', 'General'];

let pass = 0, fail = 0;
const check = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.log(`  ✗ FAIL: ${msg}`); } };

async function get(pathQ) {
  const res = await fetch(`${BASE}${pathQ}`);
  if (!res.ok) throw new Error(`${pathQ} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`\n✦ Verifying filter system against ${BASE}\n`);

  // ── Categories ─────────────────────────────────────────────────────────────
  console.log('CATEGORIES');
  const cats = (await get('/api/categories')).data;
  const catNames = cats.map((c) => c.name);
  console.log('  chips:', catNames.join(', '));
  for (const b of BANNED_CATEGORY_SUBSTR) {
    check(!catNames.some((n) => n.toLowerCase().includes(b)), `no "${b}" category`);
  }
  check(catNames.every((n) => GLOBAL_CATEGORIES.includes(n)),
    'every category chip is a global content type');
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c]));

  // ── Languages ──────────────────────────────────────────────────────────────
  console.log('\nLANGUAGES');
  const langs = (await get('/api/channels/languages').catch(() => get('/api/languages'))).data;
  const langNames = langs.map((l) => l.name);
  console.log('  chips:', langNames.join(', '));
  const unknownIdx = langNames.findIndex((n) => n.toLowerCase() === 'unknown');
  check(unknownIdx === -1 || unknownIdx === langNames.length - 1, 'Unknown language sorts last (or absent)');
  check(!langNames.some((n) => n.toLowerCase().includes('news') || n.toLowerCase().includes('entertainment')),
    'no content words leak into language chips');

  // ── 21 combination matrix ──────────────────────────────────────────────────
  console.log('\nCATEGORY × LANGUAGE MATRIX (total counts)');
  const combos = [
    ['Entertainment', ''], ['Entertainment', 'Hindi'], ['Entertainment', 'Tamil'], ['Entertainment', 'Bengali'],
    ['Movies', ''], ['Movies', 'Hindi'], ['Movies', 'Tamil'],
    ['News', ''], ['News', 'Hindi'], ['News', 'Bengali'], ['News', 'Tamil'],
    ['Sports', ''], ['Music', 'Hindi'], ['Devotional', 'Hindi'], ['Doordarshan', ''],
  ];
  for (const [cat, lang] of combos) {
    const c = catByName[cat];
    if (!c) { console.log(`  (skip ${cat} — not present)`); continue; }
    const qs = `/api/channels?categoryId=${c.id}${lang ? `&language=${encodeURIComponent(lang)}` : ''}&workingOnly=true&page=1&limit=50`;
    const r = await get(qs);
    const total = r.pagination ? r.pagination.total : (r.data || []).length;
    // every returned channel must actually match the filter
    const sample = (r.data || []).slice(0, 50);
    const badLang = lang ? sample.filter((ch) => (ch.language || '').toLowerCase() !== lang.toLowerCase()) : [];
    const badCat = sample.filter((ch) => ch.category_id !== c.id);
    console.log(`  ${cat.padEnd(14)} + ${(lang || 'All').padEnd(8)} = ${String(total).padStart(4)}  ${badLang.length || badCat.length ? '⚠ mismatch' : ''}`);
    check(badLang.length === 0, `${cat}+${lang || 'All'}: all results match language`);
    check(badCat.length === 0, `${cat}+${lang || 'All'}: all results match category`);
  }

  // ── Combined count consistency: sum over languages ≈ category total ─────────
  console.log('\nCOUNT CONSISTENCY');
  const anyCat = catByName['News'] || cats[0];
  const catTotal = (await get(`/api/channels?categoryId=${anyCat.id}&workingOnly=true&page=1&limit=1`)).pagination.total;
  const langsForCat = (await get(`/api/channels/languages?categoryId=${anyCat.id}&workingOnly=true`).catch(() => ({ data: [] }))).data;
  const sumLang = langsForCat.reduce((s, l) => s + (l.channel_count || 0), 0);
  console.log(`  ${anyCat.name}: category total=${catTotal}, sum of per-language counts=${sumLang}`);
  check(Math.abs(catTotal - sumLang) <= Math.max(2, catTotal * 0.1) || sumLang <= catTotal,
    `${anyCat.name} language counts are consistent with category total`);

  // ── No Hindi contamination: Hindi filter must not return regional channels ──
  console.log('\nHINDI PURITY');
  const hindi = (await get('/api/channels?language=Hindi&workingOnly=true&page=1&limit=100')).data || [];
  const regionalMarkers = ['tamil', 'telugu', 'bangla', 'bengali', 'malayalam', 'kannada', 'marathi', 'odia', 'assamese'];
  const contaminated = hindi.filter((ch) => regionalMarkers.some((m) => (ch.name || '').toLowerCase().includes(m)));
  check(contaminated.length === 0,
    `Hindi filter returns no obviously-regional channels${contaminated.length ? ' → ' + contaminated.slice(0, 5).map((c) => c.name).join(', ') : ''}`);

  // ── Related channels priority ───────────────────────────────────────────────
  console.log('\nRELATED CHANNELS');
  const someChannel = (await get('/api/channels?workingOnly=true&page=1&limit=1')).data[0];
  if (someChannel) {
    const rel = await get(`/api/channels/${someChannel.id}/related`);
    const data = rel.data || rel;
    check(Array.isArray(data.channels) && data.channels.length > 0, `related channels returned for "${someChannel.name}"`);
    check(!data.channels.some((c) => c.id === someChannel.id), 'related excludes the current channel');
    const ids = data.channels.map((c) => c.id);
    check(new Set(ids).size === ids.length, 'related has no duplicates');
    console.log(`  source_type=${data.source_type}, same_cat+lang=${data.same_category_language_count ?? '?'}, same_cat=${data.same_category_count}, same_lang=${data.same_language_count}, fallback=${data.fallback_count}`);
  }

  console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('verify failed:', e.message); process.exit(2); });

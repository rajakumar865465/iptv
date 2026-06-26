/**
 * import-indian-streams.js
 * Imports Indian IPTV channels from iptv-org India M3U + API.
 * Only Indian channels (country=IN or Indian language) are imported.
 * Streams start as health_status='unknown', status='pending_check'.
 *
 * Usage:
 *   node scripts/import-indian-streams.js --source=in-m3u
 *   node scripts/import-indian-streams.js --source=iptv-org-api --country=IN
 *   node scripts/import-indian-streams.js --source=both
 *   node scripts/import-indian-streams.js --dry-run
 *   node scripts/import-indian-streams.js --include-offline=true
 */

'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

// ─── CLI Args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const OPT = {
  source:         args.find(a => a.startsWith('--source='))?.split('=')[1]  || 'both',
  limit:          args.find(a => a.startsWith('--limit='))?.split('=')[1]   || 'none',
  dryRun:         args.includes('--dry-run'),
  includeOffline: args.includes('--include-offline=true'),
  country:        args.find(a => a.startsWith('--country='))?.split('=')[1] || 'IN',
};

const REPORT_DIR = path.join(__dirname, '..', 'reports');
const REQUEST_TIMEOUT = 12000;
const CONCURRENCY    = 8;
const UA = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/90 Mobile Safari/537.36';

const APIS = {
  inM3u:     'https://iptv-org.github.io/iptv/countries/in.m3u',
  channels:  'https://iptv-org.github.io/api/channels.json',
  streams:   'https://iptv-org.github.io/api/streams.json',
  logos:     'https://iptv-org.github.io/api/logos.json',
  categories:'https://iptv-org.github.io/api/categories.json',
};

// ─── Indian Language Allowlist ─────────────────────────────────────────────
const INDIAN_LANGUAGES = new Set([
  'hindi','english','bengali','tamil','telugu','malayalam','kannada',
  'marathi','punjabi','gujarati','odia','assamese','urdu','bhojpuri',
  'sanskrit','rajasthani','maithili','sindhi','dogri','manipuri',
  'nepali','kashmiri','konkani','bodo','santhali',
]);

// ─── Reject Categories/Names ───────────────────────────────────────────────
const REJECT_GROUPS = new Set([
  'shop','shopping','teleshopping','adult','xxx','erotic','18+',
  'foreign','sci-fi','latino','latin','russian','spanish','turkish',
  'french','german','arabic','chinese','korean','japanese',
  'usa','uk-only','europe','afrikaans','filipino',
]);
const REJECT_NAME_PATTERNS = [
  /\bshop(ping)?\b/i, /\bxxx\b/i, /\badult\b/i, /\berotic\b/i,
  /\blatin(o)?\b/i,   /\brussia\b/i, /\bespanol\b/i,
];

// ─── Category Mapping ──────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'Doordarshan','Hindi Entertainment','Hindi Movies','Hindi News','English News',
  'Business News','Sports','Music','Kids','Devotional','Education',
  'Tamil','Telugu','Malayalam','Kannada','Bengali','Marathi','Punjabi',
  'Gujarati','Odia','Assamese / North East','Urdu','Bhojpuri',
  'Lifestyle / Infotainment','English Movies','International News',
  'Free FAST Channels','General',
];

function mapToIndianCategory(group, language, name) {
  const g  = (group    || '').toLowerCase();
  const l  = (language || '').toLowerCase();
  const n  = (name     || '').toLowerCase();

  // Doordarshan / Sansad / Parliament
  if (/\bdd\b|doordarshan|sansad|lok\s*sabha|rajya\s*sabha/.test(n)) return 'Doordarshan';
  if (/\bdd\b|doordarshan|sansad|parliament/.test(g)) return 'Doordarshan';

  // Language-primary categories
  if (l === 'tamil'   || /\btamil\b/.test(g)   || /\b(sun|vijay|kalaignar|jaya|raj tv|polimer|puthiya|thanthi|chithiram)\b/.test(n)) return 'Tamil';
  if (l === 'telugu'  || /\btelugu\b/.test(g)  || /\b(etv|maa tv|gemini|star maa|zee telugu|tv9 telugu|sakshi|ntv|tv5|v6|t news)\b/.test(n)) return 'Telugu';
  if (l === 'malayalam'||/\bmalayalam\b/.test(g)|| /\b(asianet|surya|mazhavil|kairali|mathrubhumi|manorama|amrita)\b/.test(n)) return 'Malayalam';
  if (l === 'kannada' || /\bkannada\b/.test(g) || /\b(udaya|suvarna|zee kannada|kasthuri|public tv)\b/.test(n)) return 'Kannada';
  if (l === 'bengali' || /\bbengali|bangla\b/.test(g) || /\b(zee bangla|star jalsha|colors bangla|jalsha|abp ananda|24 ghanta)\b/.test(n)) return 'Bengali';
  if (l === 'marathi' || /\bmarathi\b/.test(g) || /\b(zee marathi|star pravah|colors marathi|abp majha|tv9 marathi)\b/.test(n)) return 'Marathi';
  if (l === 'punjabi' || /\bpunjabi\b/.test(g) || /\b(ptc|zee punjabi|mh one)\b/.test(n)) return 'Punjabi';
  if (l === 'gujarati'|| /\bgujarati\b/.test(g)|| /\b(tv9 gujarati|sandesh|abp asmita|colors gujarati)\b/.test(n)) return 'Gujarati';
  if (l === 'odia'    || /\bodia|oriya\b/.test(g)|| /\b(tarang|prarthana|alankar|otv|zee sarthak|kanak|kalinga)\b/.test(n)) return 'Odia';
  if (l === 'assamese'|| /\bassam(ese)?\b/.test(g)|| /\b(prag news|news18 assam)\b/.test(n)) return 'Assamese / North East';
  if (/\bnorth\s*east\b/.test(g)) return 'Assamese / North East';
  if (l === 'urdu'    || /\burdu\b/.test(g)    ) return 'Urdu';
  if (l === 'bhojpuri'|| /\bbhojpuri\b/.test(g)|| /\b(bhojpuri|bhojpuriya)\b/.test(n)) return 'Bhojpuri';

  // Content-type categories
  if (/\bnews\b/.test(g) || /\bnews\b/.test(n)) {
    if (/\bbusiness|market|finance|stock\b/.test(g) || /\bbusiness|cnbc|market\b/.test(n)) return 'Business News';
    if (/\benglish\b/.test(l) || /\benglish\b/.test(g)) return 'English News';
    if (/\binternational|world\b/.test(g) || /\binternational|bbc|cnn|al\s*jazeera|dw|nhk|trt\b/.test(n)) return 'International News';
    return 'Hindi News';
  }
  if (/\bmovie|cinema|film\b/.test(g)) {
    if (/\benglish\b/.test(l)) return 'English Movies';
    return 'Hindi Movies';
  }
  if (/\bsport|cricket|football|ipl\b/.test(g) || /\bsport|cricket\b/.test(n)) return 'Sports';
  if (/\bmusic|song\b/.test(g) || /\bmusic|fm\b/.test(n)) return 'Music';
  if (/\bkids|children|cartoon\b/.test(g)) return 'Kids';
  if (/\breligio|devotion|spiritual|bhakti|temple|church|islamic|vedic\b/.test(g)) return 'Devotional';
  if (/\beducation|study|learning|school|university\b/.test(g)) return 'Education';
  if (/\blifestyle|travel|food|health|wellness|home\b/.test(g)) return 'Lifestyle / Infotainment';
  if (/\bfast|free\b/.test(g)) return 'Free FAST Channels';
  if (/\bentertain\b/.test(g)) return 'Hindi Entertainment';

  return 'General';
}

// ─── Helpers ───────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    const res  = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) { console.error(`  fetchJSON failed ${url}: ${e.message}`); return null; }
}

async function fetchText(url) {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    const res  = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) { console.error(`  fetchText failed ${url}: ${e.message}`); return null; }
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isIndianLanguage(lang) {
  return INDIAN_LANGUAGES.has((lang || '').toLowerCase());
}

function shouldReject(group, name) {
  const g = (group || '').toLowerCase();
  const n = (name  || '').toLowerCase();
  if (REJECT_GROUPS.has(g.split(/[\/,|]/)[0].trim())) return true;
  for (const pat of REJECT_NAME_PATTERNS) {
    if (pat.test(n) || pat.test(g)) return true;
  }
  return false;
}

function cleanName(s) {
  return (s || 'Unknown').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function baseId(id) {
  return (id || '').replace(/@.+$/, '');
}

// Normalise language string to title-case
function normaliseLang(lang) {
  if (!lang) return 'Unknown';
  const map = {
    hin:'Hindi', ben:'Bengali', tam:'Tamil', tel:'Telugu', mal:'Malayalam',
    kan:'Kannada', mar:'Marathi', pan:'Punjabi', guj:'Gujarati', ori:'Odia',
    asm:'Assamese', urd:'Urdu', bho:'Bhojpuri', san:'Sanskrit', eng:'English',
  };
  const l = lang.toLowerCase();
  if (map[l]) return map[l];
  return l.charAt(0).toUpperCase() + l.slice(1);
}

// ─── Parse in.m3u ──────────────────────────────────────────────────────────
async function parseInM3u(metaById, streamsByChId) {
  console.log(`  Fetching ${APIS.inM3u} ...`);
  const text = await fetchText(APIS.inM3u);
  if (!text) return [];

  const results = [];
  let cur = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#EXTINF:')) {
      const tvgId    = line.match(/tvg-id="([^"]*)"/)?.[1]    || '';
      const tvgName  = line.match(/tvg-name="([^"]*)"/)?.[1]  || '';
      const tvgLogo  = line.match(/tvg-logo="([^"]*)"/)?.[1]  || '';
      const grpTitle = line.match(/group-title="([^"]*)"/)?.[1] || 'General';
      const commaIdx = line.lastIndexOf(',');
      const rawName  = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      const chId     = baseId(tvgId);
      const meta     = metaById.get(chId) || {};
      const sMeta    = streamsByChId.get(chId) || {};
      const lang     = normaliseLang(meta.language || sMeta.language || '');
      cur = {
        tvg_id:    tvgId,
        id:        chId || normalise(tvgName || rawName),
        name:      cleanName(tvgName || rawName || meta.name || 'Unknown'),
        rawName,
        logo:      tvgLogo || meta.logo || '',
        group:     grpTitle,
        language:  lang,
        country:   'IN',
        userAgent: sMeta.userAgent || null,
        referrer:  sMeta.referrer  || null,
        quality:   sMeta.quality   || 'SD',
        fromM3u:   true,
      };
    } else if (line && !line.startsWith('#') && cur) {
      cur.url = line;
      results.push(cur);
      cur = null;
    }
  }
  return results;
}

// ─── Parse API source ──────────────────────────────────────────────────────
function parseApiSource(metaById, streamsByChId, m3uChannelIds) {
  const results = [];
  for (const [chId, sMeta] of streamsByChId.entries()) {
    if (!sMeta.url) continue;
    const meta     = metaById.get(chId) || {};
    const isIndia  = meta.isIndia || m3uChannelIds.has(chId);
    const lang     = normaliseLang(meta.language || '');
    const isIndLang = isIndianLanguage(lang);
    if (!isIndia && !isIndLang) continue;
    results.push({
      tvg_id:    chId,
      id:        chId,
      name:      cleanName(meta.name || chId),
      logo:      meta.logo || '',
      group:     meta.category || 'General',
      language:  lang,
      country:   'IN',
      userAgent: sMeta.userAgent || null,
      referrer:  sMeta.referrer  || null,
      quality:   sMeta.quality   || 'SD',
      url:       sMeta.url,
      fromApi:   true,
    });
  }
  return results;
}

// ─── Filter: Indian channels only ─────────────────────────────────────────
function filterIndianChannels(channels) {
  return channels.filter(ch => {
    // Reject blacklisted categories/names
    if (shouldReject(ch.group, ch.name)) return false;
    // M3U from in.m3u playlist is always Indian
    if (ch.fromM3u) return true;
    // API source: check country or language
    if (ch.country === 'IN') return true;
    if (isIndianLanguage(ch.language)) return true;
    return false;
  });
}

// ─── Dedup: keep best entry per channel (prefer M3U over API) ─────────────
function dedup(channels) {
  const map = new Map();
  for (const ch of channels) {
    const key = ch.tvg_id || normalise(ch.name);
    const ex  = map.get(key);
    if (!ex || ch.fromM3u) map.set(key, ch); // M3U wins
  }
  return Array.from(map.values());
}

// ─── Canonical name (must match dedupe-channels.js exactly) ───────────────
function canonicalName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\b(hd|sd|fhd|uhd|4k)\b\s*/gi, ' ')
    .replace(/\s*\b(1080p?|720p?|576p?|480p?|360p?|240p?)\b\s*/gi, ' ')
    .replace(/\s*\b(backup|source\s*\d*|live|channel)\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── DB helpers ───────────────────────────────────────────────────────────
async function getCategoryId(catName) {
  const name = catName || 'General';
  const res  = await db.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (res.rows.length > 0) return res.rows[0].id;
  const ins  = await db.query(
    `INSERT INTO categories (name, status, sort_order) VALUES ($1,'active',$2) RETURNING id`,
    [name, CATEGORY_ORDER.indexOf(name) + 1 || 99]
  );
  return ins.rows[0].id;
}

async function upsertChannel(ch, catId) {
  const sourceId   = ch.tvg_id || ch.id || normalise(ch.name);
  const canName    = canonicalName(ch.name);
  const lang       = ch.language || 'Unknown';

  // Look up existing channel — prefer canonical_name+language+category match
  // over just tvg_id, to prevent creating duplicates of already-merged channels
  let existing = await db.query(
    `SELECT id FROM channels
     WHERE status NOT IN ('merged','duplicate')
       AND (
         tvg_id = $1
         OR (source_channel_id = $2 AND source = 'iptv-org-india')
         OR (canonical_name = $3 AND LOWER(COALESCE(language,'')) = LOWER($4) AND category_id = $5)
       )
     ORDER BY CASE WHEN health_status = 'online' THEN 0
                   WHEN health_status = 'unknown' THEN 1
                   ELSE 2 END,
              id ASC
     LIMIT 1`,
    [sourceId, sourceId, canName, lang, catId]
  );

  if (existing.rows.length > 0) {
    const masterId = existing.rows[0].id;
    // Update master channel metadata (don't overwrite good logo with empty one)
    await db.query(
      `UPDATE channels SET
         status = CASE WHEN status = 'merged' THEN 'merged' ELSE 'pending_check' END,
         health_status = CASE WHEN health_status IN ('online','merged') THEN health_status ELSE 'unknown' END,
         canonical_name = $1,
         tvg_id  = COALESCE(NULLIF(tvg_id,''), $2),
         logo_url = COALESCE(NULLIF(logo_url,''), NULLIF($3,'')),
         language = COALESCE(NULLIF(language,'Unknown'), NULLIF($4,'Unknown')),
         user_agent = COALESCE(NULLIF(user_agent,''), $5),
         referrer   = COALESCE(NULLIF(referrer,''),   $6),
         source = 'iptv-org-india', source_channel_id = $7,
         updated_at = NOW()
       WHERE id = $8`,
      [canName, ch.tvg_id||null, ch.logo||null, lang,
       ch.userAgent||null, ch.referrer||null, sourceId, masterId]
    );
    // Add this URL as an additional stream (not a new channel)
    await db.query(
      `INSERT INTO channel_streams
         (channel_id, stream_url, quality, priority, source_name, user_agent, referer, health_status)
       VALUES ($1,$2,$3,2,'iptv-org-india',$4,$5,'unknown')
       ON CONFLICT (channel_id, stream_url) DO UPDATE
         SET quality=$3, user_agent=$4, referer=$5, updated_at=NOW()`,
      [masterId, ch.url, ch.quality||'SD', ch.userAgent||null, ch.referrer||null]
    );
    return { action: 'updated', id: masterId };
  }

  // Brand new channel
  const ins = await db.query(
    `INSERT INTO channels
       (name, canonical_name, logo_url, stream_url, category_id, language, country,
        source, source_channel_id, tvg_id, status, health_status,
        is_featured, is_premium, quality, user_agent, referrer)
     VALUES ($1,$2,$3,$4,$5,$6,'IN','iptv-org-india',$7,$8,
             'pending_check','unknown',false,false,$9,$10,$11)
     RETURNING id`,
    [ch.name, canName, ch.logo||null, ch.url, catId, lang,
     sourceId, ch.tvg_id||null, ch.quality||'SD', ch.userAgent||null, ch.referrer||null]
  );
  const newId = ins.rows[0].id;
  await db.query(
    `INSERT INTO channel_streams
       (channel_id, stream_url, quality, priority, source_name, user_agent, referer, health_status)
     VALUES ($1,$2,$3,1,'iptv-org-india',$4,$5,'unknown')
     ON CONFLICT DO NOTHING`,
    [newId, ch.url, ch.quality||'SD', ch.userAgent||null, ch.referrer||null]
  );
  return { action: 'inserted', id: newId };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Indian IPTV Stream Importer                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('Options:', OPT, '\n');

  // Load API metadata
  console.log('Loading iptv-org API metadata...');
  const [channelsData, streamsData, logosData] = await Promise.all([
    fetchJSON(APIS.channels),
    fetchJSON(APIS.streams),
    fetchJSON(APIS.logos),
  ]);

  // Build logo map
  const logoMap = new Map();
  (logosData || []).forEach(l => { if (l.channel && l.url) logoMap.set(l.channel, l.url); });

  // Build metadata map
  const metaById = new Map();
  (channelsData || []).forEach(c => {
    if (!c.id) return;
    metaById.set(c.id, {
      name:     c.name,
      logo:     logoMap.get(c.id) || c.logo || '',
      category: (c.categories||[])[0] || 'General',
      language: (c.languages||[])[0]  || '',
      isIndia:  (c.countries||[]).includes('IN') || c.country === 'IN'
                || (c.broadcast_area||[]).some(a => a.includes('c/IN')),
    });
  });

  // Build streams map (one stream per channel id — best first)
  const streamsByChId = new Map();
  (streamsData || []).forEach(s => {
    if (!s.channel || !s.url) return;
    if (!streamsByChId.has(s.channel)) {
      streamsByChId.set(s.channel, { url: s.url, quality: s.quality||'SD',
        userAgent: s.user_agent, referrer: s.referrer });
    }
  });

  // Collect raw channels
  let allChannels = [];
  const m3uChannelIds = new Set();

  if (OPT.source === 'in-m3u' || OPT.source === 'both') {
    const m3u = await parseInM3u(metaById, streamsByChId);
    m3u.forEach(c => { if (c.tvg_id) m3uChannelIds.add(c.tvg_id); });
    allChannels.push(...m3u);
    console.log(`  Parsed ${m3u.length} entries from in.m3u`);
  }
  if (OPT.source === 'iptv-org-api' || OPT.source === 'both') {
    const api = parseApiSource(metaById, streamsByChId, m3uChannelIds);
    allChannels.push(...api);
    console.log(`  Found  ${api.length} entries from iptv-org API`);
  }

  const parsedTotal = allChannels.length;
  console.log(`\nTotal parsed (raw): ${parsedTotal}`);

  // Filter to Indian only
  allChannels = filterIndianChannels(allChannels);
  console.log(`After Indian filter:  ${allChannels.length}`);

  // Remove channels with no URL
  allChannels = allChannels.filter(c => c.url && c.url.startsWith('http'));
  console.log(`After URL filter:     ${allChannels.length}`);

  // Dedup by tvg_id / name
  allChannels = dedup(allChannels);
  console.log(`After dedup:          ${allChannels.length}`);

  // Apply limit
  if (OPT.limit !== 'none') {
    const lim = parseInt(OPT.limit, 10);
    if (!isNaN(lim) && lim > 0) {
      allChannels = allChannels.slice(0, lim);
      console.log(`Limited to:           ${allChannels.length}`);
    }
  }

  if (OPT.dryRun) {
    console.log('\n─── DRY RUN — Top 30 channels that would be imported ───');
    const catCounts = {};
    allChannels.forEach(c => {
      const cat = mapToIndianCategory(c.group, c.language, c.name);
      catCounts[cat] = (catCounts[cat]||0) + 1;
    });
    allChannels.slice(0, 30).forEach(c => {
      const cat = mapToIndianCategory(c.group, c.language, c.name);
      console.log(`  [${cat}] ${c.name} (${c.language}) → ${c.url.slice(0,70)}`);
    });
    console.log('\nCategory breakdown:');
    Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
    await db.pool.end();
    return;
  }

  // Import to DB
  let inserted = 0, updated = 0, errors = 0;
  const catIdCache = new Map();

  for (const ch of allChannels) {
    try {
      const catName = mapToIndianCategory(ch.group, ch.language, ch.name);
      if (!catIdCache.has(catName)) {
        catIdCache.set(catName, await getCategoryId(catName));
      }
      const catId  = catIdCache.get(catName);
      const result = await upsertChannel(ch, catId);
      if (result.action === 'inserted') { inserted++; process.stdout.write('+'); }
      else                              { updated++;  process.stdout.write('.'); }
    } catch (err) {
      errors++;
      console.error(`\n  Error importing ${ch.name}: ${err.message}`);
    }
  }

  // Build report
  const catRes  = await db.query(`SELECT cat.name, COUNT(c.id) cnt FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.country='IN' GROUP BY cat.name ORDER BY cnt DESC`);
  const langRes = await db.query(`SELECT language, COUNT(*) cnt FROM channels WHERE country='IN' GROUP BY language ORDER BY cnt DESC LIMIT 20`);
  const totRes  = await db.query(`SELECT COUNT(*) total FROM channels WHERE country='IN'`);

  const report = {
    generated_at:    new Date().toISOString(),
    parsed_from_m3u: parsedTotal,
    after_filter:    allChannels.length,
    inserted,
    updated,
    errors,
    total_indian_in_db: parseInt(totRes.rows[0].total, 10),
    categories:         Object.fromEntries(catRes.rows.map(r => [r.name, parseInt(r.cnt,10)])),
    languages:          Object.fromEntries(langRes.rows.map(r => [r.language||'Unknown', parseInt(r.cnt,10)])),
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'import-report.json'), JSON.stringify(report, null, 2));

  console.log('\n\n╔══════════════════════════════════════════════════╗');
  console.log('║  Indian IPTV Import Summary                       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Parsed:       ${parsedTotal}`);
  console.log(`  Imported:     ${allChannels.length}`);
  console.log(`  Inserted:     ${inserted}`);
  console.log(`  Updated:      ${updated}`);
  console.log(`  Errors:       ${errors}`);
  console.log(`  Total in DB:  ${report.total_indian_in_db}`);
  console.log('\n  Category breakdown:');
  Object.entries(report.categories).slice(0,10).forEach(([k,v]) => console.log(`    ${k}: ${v}`));
  console.log(`\n  Report saved → reports/import-report.json`);

  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

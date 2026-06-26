'use strict';
/**
 * import-working-m3u.js
 * ──────────────────────────────────────────────────────────────────────────
 * Reads working_iptv.m3u from the repo root, then:
 *   1. Parses every #EXTINF + URL pair (with tvg-id, tvg-logo, group-title)
 *   2. For each channel:
 *      a. If the stream_url already exists in channel_streams → SKIP (no dup)
 *      b. If a channel with the same canonical_name+language+category_id
 *         already exists → ADD the URL as an extra channel_stream only
 *      c. Otherwise → INSERT a new channel + channel_stream
 *   3. Prints a summary: inserted / stream-added / skipped / errors
 *
 * Usage (from repo root):
 *   node backend/scripts/import-working-m3u.js
 *   node backend/scripts/import-working-m3u.js --dry-run
 *   node backend/scripts/import-working-m3u.js --replace-dead   ← also updates
 *                                                                  dead streams
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs   = require('fs');
const path = require('path');

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const REPLACE_DEAD = args.includes('--replace-dead');

// Only require DB when actually writing
const db = DRY_RUN ? null : require('../src/config/db');
const M3U_PATH   = path.join(__dirname, '..', '..', 'working_iptv.m3u');

// ── Quality inference ──────────────────────────────────────────────────────
function inferQuality(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('4k') || n.includes('2160')) return '4K';
  if (n.includes('1080') || n.includes('fhd')) return '1080p';
  if (n.includes('720')  || n.includes(' hd')) return '720p';
  if (n.includes('576'))  return '576p';
  if (n.includes('540'))  return '540p';
  if (n.includes('480'))  return '480p';
  if (n.includes('396') || n.includes('404') || n.includes('360')) return '360p';
  if (n.includes('240'))  return '240p';
  return 'SD';
}

// ── Group → category name map ──────────────────────────────────────────────
const GROUP_TO_CAT = {
  'Indian-Hindi':      'Hindi Entertainment',
  'Discovery-Factual': 'Lifestyle / Infotainment',
  'English-Popular':   'International News',
};

// ── Detect better category from channel name ───────────────────────────────
function smartCategory(name, group) {
  const n = (name || '').toLowerCase();

  if (/\bdd\b|doordarshan|sansad/.test(n)) return 'Doordarshan';
  if (/news/.test(n)) {
    if (/\bcnbc|business|markets?|economic|finance\b/.test(n)) return 'Business News';
    if (/\benglish\b|\bnow\b|bbc|cnn|ndtv.*24|times now|republic tv/.test(n)) return 'English News';
    if (/\binternational|world|al\s*jazeera|france 24|dw |trt|rt \b|bloomberg/.test(n)) return 'International News';
    if (/\btamil/.test(n)) return 'Tamil';
    if (/\btelugu/.test(n)) return 'Telugu';
    if (/\bmalayalam|kerala\b/.test(n)) return 'Malayalam';
    if (/\bkannada\b/.test(n)) return 'Kannada';
    if (/\bbengali|bangla\b/.test(n)) return 'Bengali';
    if (/\bmarathi\b/.test(n)) return 'Marathi';
    if (/\bpunjabi\b/.test(n)) return 'Punjabi';
    if (/\bgujarati\b/.test(n)) return 'Gujarati';
    if (/\bodia|odisha\b/.test(n)) return 'Odia';
    if (/\bassam/.test(n)) return 'Assamese / North East';
    if (/\burdu\b/.test(n)) return 'Urdu';
    return 'Hindi News';
  }
  if (/\bsport|cricket|football|ipl\b/.test(n)) return 'Sports';
  if (/\bmusic|songs?\b/.test(n)) return 'Music';
  if (/\bkids|cartoon|toon|nick\b/.test(n)) return 'Kids';
  if (/\bbhakti|bhakthi|devotion|temple|vedic|sankara|divine|peace tv\b/.test(n)) return 'Devotional';
  if (/\bcinema|movies?\b/.test(n)) return 'Hindi Movies';
  if (/\bdocumentar|factual|nature|discovery|wildlife\b/.test(n)) return 'Lifestyle / Infotainment';
  if (/\btamil/.test(n)) return 'Tamil';
  if (/\btelugu/.test(n)) return 'Telugu';
  if (/\bmalayalam|kerala/.test(n)) return 'Malayalam';
  if (/\bkannada/.test(n)) return 'Kannada';
  if (/\bbengali|bangla/.test(n)) return 'Bengali';
  if (/\bmarathi/.test(n)) return 'Marathi';
  if (/\bpunjabi/.test(n)) return 'Punjabi';
  if (/\bgujarati/.test(n)) return 'Gujarati';
  if (/\bodia|odisha/.test(n)) return 'Odia';
  if (/\bassam/.test(n)) return 'Assamese / North East';
  if (/\burdu/.test(n)) return 'Urdu';

  return GROUP_TO_CAT[group] || 'General';
}

// ── Language inference from channel name / category ────────────────────────
function inferLanguage(name, catName) {
  const n = (name    || '').toLowerCase();
  const c = (catName || '').toLowerCase();
  if (c.includes('tamil')   || n.includes('tamil'))   return 'Tamil';
  if (c.includes('telugu')  || n.includes('telugu'))  return 'Telugu';
  if (c.includes('malayal') || n.includes('malayal')) return 'Malayalam';
  if (c.includes('kannada') || n.includes('kannada')) return 'Kannada';
  if (c.includes('bengali') || n.includes('bangla')
      || n.includes('bengali')) return 'Bengali';
  if (c.includes('marathi') || n.includes('marathi')) return 'Marathi';
  if (c.includes('punjabi') || n.includes('punjabi')) return 'Punjabi';
  if (c.includes('gujarati')|| n.includes('gujarati'))return 'Gujarati';
  if (c.includes('odia')    || n.includes('odish'))   return 'Odia';
  if (c.includes('assam')   || n.includes('assam'))   return 'Assamese';
  if (c.includes('urdu')    || n.includes('urdu'))    return 'Urdu';
  if (c.includes('bhojpuri')|| n.includes('bhojpuri'))return 'Bhojpuri';
  if (c.includes('doordarshan'))  return 'Hindi';
  if (c.includes('english') || c.includes('international') || c.includes('factual')) return 'English';
  return 'Hindi';
}

// ── Canonical name normalizer (matches backend dedup logic exactly) ─────────
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

// ── Parse the M3U file ─────────────────────────────────────────────────────
function parseM3U(filePath) {
  const lines   = fs.readFileSync(filePath, 'utf8').split('\n');
  const entries = [];
  let cur       = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const tvgId    = line.match(/tvg-id="([^"]*)"/)?.[1]      || '';
      const tvgLogo  = line.match(/tvg-logo="([^"]*)"/)?.[1]    || '';
      const group    = line.match(/group-title="([^"]*)"/)?.[1] || 'General';
      const commaIdx = line.lastIndexOf(',');
      const rawName  = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      // Strip flags like [Geo-blocked] [Not 24/7] from display name
      const cleanedName = rawName.replace(/\s*\[.*?\]\s*/g, '').trim();
      cur = { tvgId, tvgLogo, group, rawName: cleanedName };
    } else if (line && !line.startsWith('#') && cur) {
      cur.url = line;
      entries.push(cur);
      cur = null;
    }
  }
  return entries;
}

// ── Get or create a category ───────────────────────────────────────────────
const catCache = new Map();
async function getCategoryId(catName) {
  if (catCache.has(catName)) return catCache.get(catName);
  const res = await db.query('SELECT id FROM categories WHERE name = $1', [catName]);
  if (res.rows.length > 0) {
    catCache.set(catName, res.rows[0].id);
    return res.rows[0].id;
  }
  const ins = await db.query(
    `INSERT INTO categories (name, status, sort_order) VALUES ($1,'active',99) RETURNING id`,
    [catName]
  );
  catCache.set(catName, ins.rows[0].id);
  return ins.rows[0].id;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(M3U_PATH)) {
    console.error(`ERROR: M3U file not found at ${M3U_PATH}`);
    process.exit(1);
  }

  const entries = parseM3U(M3U_PATH);
  console.log(`\n✦ Parsed ${entries.length} entries from working_iptv.m3u`);
  if (DRY_RUN) console.log('  ── DRY RUN MODE (nothing written to DB) ──\n');

  let inserted = 0, streamAdded = 0, streamReplaced = 0, skipped = 0, errors = 0;
  const log = { inserted: [], streamAdded: [], skipped: [], replaced: [], errors: [] };

  for (const entry of entries) {
    const { tvgId, tvgLogo, group, rawName: name, url } = entry;
    try {
      const catName  = smartCategory(name, group);
      const language = inferLanguage(name, catName);
      const quality  = inferQuality(name);
      const canon    = canonicalName(name);

      // ── DRY RUN — just show what would happen ────────────────────────
      if (DRY_RUN) {
        console.log(`  [DRY] [${catName}] ${name} (${language}/${quality})`);
        inserted++;
        continue;
      }

      // ── 1. Check if this exact stream URL already exists ──────────────
      const streamCheck = await db.query(
        `SELECT cs.id, cs.channel_id, cs.health_status
         FROM channel_streams cs
         WHERE cs.stream_url = $1
         LIMIT 1`,
        [url]
      );

      if (streamCheck.rows.length > 0) {
        const existing = streamCheck.rows[0];
        // If --replace-dead, update the health check timestamp but don't re-insert
        if (REPLACE_DEAD && existing.health_status === 'offline' && !DRY_RUN) {
          await db.query(
            `UPDATE channel_streams
             SET health_status = 'unknown', health_score = 100,
                 fail_count = 0, last_checked_at = NULL, updated_at = NOW()
             WHERE id = $1`,
            [existing.id]
          );
          streamReplaced++;
          log.replaced.push(`${name} (stream_id=${existing.id} → reset to unknown)`);
        } else {
          skipped++;
          log.skipped.push(`${name} (url already in channel_id=${existing.channel_id})`);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would import: [${catName}] ${name} (${language}/${quality})`);
        inserted++;
        continue;
      }

      const catId = await getCategoryId(catName);

      // ── 2. Check for existing channel by canonical name + language + cat ──
      const chanCheck = await db.query(
        `SELECT id, health_status FROM channels
         WHERE status NOT IN ('merged','duplicate')
           AND canonical_name = $1
           AND LOWER(COALESCE(language,'')) = LOWER($2)
           AND category_id = $3
         ORDER BY CASE WHEN health_status = 'online' THEN 0
                       WHEN health_status = 'unknown' THEN 1
                       ELSE 2 END, id ASC
         LIMIT 1`,
        [canon, language, catId]
      );

      if (chanCheck.rows.length > 0) {
        // Channel exists — add this as an additional stream (backup source)
        const chanId = chanCheck.rows[0].id;
        await db.query(
          `INSERT INTO channel_streams
             (channel_id, stream_url, quality, priority, source_name, health_status, health_score)
           VALUES ($1, $2, $3, 2, 'working-m3u', 'unknown', 100)
           ON CONFLICT (channel_id, stream_url) DO NOTHING`,
          [chanId, url, quality]
        );
        // Update logo if missing
        if (tvgLogo) {
          await db.query(
            `UPDATE channels SET logo_url = COALESCE(NULLIF(logo_url,''), $1),
               updated_at = NOW() WHERE id = $2`,
            [tvgLogo, chanId]
          );
        }
        // Update has_backup_streams
        await db.query(
          `UPDATE channels SET has_backup_streams = (
             SELECT COUNT(*) > 1 FROM channel_streams WHERE channel_id = $1
           ) WHERE id = $1`,
          [chanId]
        );
        streamAdded++;
        log.streamAdded.push(`${name} → channel_id=${chanId} as backup stream`);
        continue;
      }

      // ── 3. Completely new channel — insert channel + primary stream ────
      const ins = await db.query(
        `INSERT INTO channels
           (name, canonical_name, logo_url, stream_url, category_id,
            language, country, source, tvg_id, quality,
            status, health_status, health_score,
            is_featured, is_premium, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,'IN','working-m3u',$7,$8,
                 'active','unknown',100,false,false,0)
         RETURNING id`,
        [name, canon, tvgLogo || null, url, catId,
         language, tvgId || null, quality]
      );
      const newId = ins.rows[0].id;

      await db.query(
        `INSERT INTO channel_streams
           (channel_id, stream_url, quality, priority, source_name, health_status, health_score)
         VALUES ($1,$2,$3,1,'working-m3u','unknown',100)
         ON CONFLICT DO NOTHING`,
        [newId, url, quality]
      );

      inserted++;
      log.inserted.push(`[${catName}] ${name} (id=${newId})`);

    } catch (err) {
      errors++;
      log.errors.push(`${name}: ${err.message}`);
      console.error(`  ERROR importing "${name}": ${err.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Import Working M3U — Summary                        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total parsed:      ${entries.length}`);
  console.log(`  Inserted (new):    ${inserted}`);
  console.log(`  Stream added:      ${streamAdded}  (extra source on existing channel)`);
  console.log(`  Stream replaced:   ${streamReplaced}  (dead → reset to unknown)`);
  console.log(`  Skipped (exist):   ${skipped}`);
  console.log(`  Errors:            ${errors}`);

  if (log.inserted.length) {
    console.log('\n  ── Newly inserted channels ──');
    log.inserted.forEach(l => console.log('    +', l));
  }
  if (log.streamAdded.length) {
    console.log('\n  ── Extra streams added to existing channels ──');
    log.streamAdded.slice(0, 20).forEach(l => console.log('    ~', l));
    if (log.streamAdded.length > 20) console.log(`    … and ${log.streamAdded.length - 20} more`);
  }
  if (log.replaced.length) {
    console.log('\n  ── Dead streams reset ──');
    log.replaced.forEach(l => console.log('    ↺', l));
  }
  if (log.errors.length) {
    console.log('\n  ── Errors ──');
    log.errors.forEach(l => console.log('    ✗', l));
  }

  if (!DRY_RUN) {
    // After import, activate all newly imported channels
    const activeRes = await db.query(
      `UPDATE channels SET status = 'active'
       WHERE status = 'pending_check'
         AND source = 'working-m3u'`
    );
    console.log(`\n  Activated ${activeRes.rowCount} newly imported channels.`);
    await db.pool.end();
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

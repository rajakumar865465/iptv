/**
 * Mass Import From iptv-org India M3U Playlist
 *
 * Fetches ALL channels from the complete iptv-org India playlist,
 * maps group-titles to app categories, and upserts into the DB.
 * By default checks each stream and skips offline ones.
 *
 * Usage:
 *   node scripts/mass-import-from-iptv-org.js             # import all online channels
 *   node scripts/mass-import-from-iptv-org.js --no-check  # skip stream checks (import all)
 *   node scripts/mass-import-from-iptv-org.js --dry-run   # preview only, no DB writes
 */

require('dotenv').config();
const db = require('../src/config/db');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CHECK_STREAMS = !args.includes('--no-check');
const CONCURRENCY = 10;
const TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36';

// Source URL - the official iptv-org India country playlist
const INDIA_M3U_URL = 'https://iptv-org.github.io/iptv/countries/in.m3u';

// Map group-title values from M3U to app category names
const GROUP_TO_CATEGORY = {
  'Entertainment': 'Hindi Entertainment',
  'Movies': 'Hindi Movies',
  'News': 'Hindi News',
  'Business': 'Business News',
  'Sports': 'Sports',
  'Music': 'Music',
  'Kids': 'Kids',
  'Religious': 'Devotional',
  'Education': 'Education',
  'General': 'Doordarshan',
  'Culture': 'Hindi Entertainment',
  'Lifestyle': 'Lifestyle / Infotainment',
  'Cooking': 'Lifestyle / Infotainment',
  'Documentary': 'Lifestyle / Infotainment',
  'Outdoor': 'Lifestyle / Infotainment',
  'Animation': 'Kids',
  'Comedy': 'Hindi Entertainment',
  'Undefined': 'Free FAST Channels',
  'Science': 'Education',
};

// Override specific channels to correct categories
const CHANNEL_CATEGORY_OVERRIDES = {
  // Doordarshan channels
  'DD National': 'Doordarshan', 'DD National HD': 'Doordarshan', 'DD National SD': 'Doordarshan',
  'DD News': 'Doordarshan', 'DD News HD': 'Doordarshan',
  'DD India': 'Doordarshan', 'DD Bharati': 'Doordarshan',
  'DD Sports': 'Sports', 'DD Sports SD': 'Sports',
  'DD Kisan': 'Education',
  'DD Bihar': 'Doordarshan', 'DD Chandana': 'Doordarshan',
  'DD Madhya Pradesh': 'Doordarshan', 'DD Uttar Pradesh': 'Doordarshan',
  'DD Rajasthan': 'Doordarshan', 'DD Uttarakhand': 'Doordarshan',
  'DD Chhattisgarh': 'Doordarshan', 'DD Punjab': 'Doordarshan',
  'DD Himachal Pradesh': 'Doordarshan', 'DD Jharkhand': 'Doordarshan',
  'DD Haryana': 'Doordarshan', 'DD Goa': 'Doordarshan',
  'DD Arun Prabha': 'Doordarshan', 'DD Manipur': 'Doordarshan',
  'DD Meghalaya': 'Doordarshan', 'DD Mizoram': 'Doordarshan',
  'DD Nagaland': 'Doordarshan', 'DD Tripura': 'Doordarshan',
  'DD Assam': 'Assamese / North East', 'DD Kashir': 'Urdu',
  'DD Bangla': 'Bengali', 'DD Sahyadri': 'Marathi',
  'DD Saptagiri': 'Telugu', 'DD Yadagiri': 'Telugu',
  'DD Odia': 'Odia', 'DD Girnar': 'Gujarati',
  'DD Urdu': 'Urdu', 'DD Tamil': 'Tamil',
  'DD Telugu': 'Telugu', 'DD Malayalam': 'Malayalam',
  'DD Kannada': 'Kannada', 'DD Marathi': 'Marathi',
  'DD Gujarati': 'Gujarati', 'DD Punjab': 'Punjabi',
  'DD Punjabi': 'Punjabi',
  // Tamil
  'Star Vijay': 'Tamil', 'Sun TV': 'Tamil', 'Colors Tamil': 'Tamil', 'Colors Tamil HD': 'Tamil',
  'Zee Tamil': 'Tamil', 'Jaya TV': 'Tamil', 'Jaya Max': 'Tamil',
  'Kalaignar TV': 'Tamil', 'Raj TV': 'Tamil', 'Makkal TV': 'Tamil',
  'Polimer TV': 'Tamil', 'Puthuyugam TV': 'Tamil', 'Vendhar TV': 'Tamil',
  'Captain': 'Tamil', 'Sirippoli TV': 'Tamil', 'Thanthi TV': 'Tamil',
  'Puthiya Thalaimurai': 'Tamil', 'News7 Tamil': 'Tamil',
  'Polimer News': 'Tamil', 'Sun News': 'Tamil', 'Kalaignar Seithigal': 'Tamil',
  'Aaryaa TV': 'Tamil', 'Raj News Tamil': 'Tamil', 'Sathiyam TV': 'Tamil',
  'Chithiram': 'Kids',
  // Telugu
  'Star Maa': 'Telugu', 'Zee Telugu': 'Telugu', 'Gemini TV': 'Telugu',
  'ETV Telugu': 'Telugu', 'ETV Telugu HD': 'Telugu',
  'ETV Cinema': 'Telugu', 'ETV Cinema HD': 'Telugu',
  'ETV Life': 'Telugu', 'ETV Andhra Pradesh': 'Telugu',
  'ETV Telangana': 'Telugu', 'ETV Plus': 'Telugu',
  'T News': 'Telugu', 'TV9 Telugu': 'Telugu', 'NTV Telugu': 'Telugu',
  'ABN Andhra Jyoti': 'Telugu', 'V6 News': 'Telugu',
  'TV5 News': 'Telugu', 'HMTV': 'Telugu', 'Prime9 News': 'Telugu',
  'Mahaa News': 'Telugu', 'Raj Musix Telugu': 'Telugu',
  'Mahaa Max': 'Telugu', 'Sakshi TV': 'Telugu', '10 TV': 'Telugu',
  // Malayalam
  'Asianet': 'Malayalam', 'Asianet News': 'Malayalam',
  'Asianet Movies': 'Malayalam', 'Asianet Plus': 'Malayalam',
  'Amrita TV': 'Malayalam', 'Mazhavil Manorama': 'Malayalam',
  'Mazhavil Manorama HD': 'Malayalam', 'Surya TV': 'Malayalam',
  'Flowers TV': 'Malayalam', 'Kairali TV': 'Malayalam',
  'Kairali We': 'Malayalam', 'Jaihind TV': 'Malayalam',
  'Kaumudy TV': 'Malayalam', 'Kappa TV': 'Malayalam',
  'Manorama News': 'Malayalam', 'Mathrubhumi News': 'Malayalam',
  '24 News': 'Malayalam', 'Reporter TV': 'Malayalam',
  'Kairali News': 'Malayalam', 'MediaOne TV': 'Malayalam',
  'Media One': 'Malayalam', 'Janam TV': 'Malayalam',
  'News18 Kerala': 'Malayalam', 'Real News Kerala': 'Malayalam',
  'Kerala Vision': 'Malayalam',
  // Kannada
  'Colors Kannada': 'Kannada', 'Colors Kannada HD': 'Kannada',
  'Colors Kannada Cinema': 'Kannada', 'Zee Kannada': 'Kannada',
  'Udaya TV': 'Kannada', 'Star Suvarna': 'Kannada',
  'Colors Super': 'Kannada', 'Udaya Movies': 'Kannada',
  'Udaya Music': 'Kannada', 'Asianet Suvarna News': 'Kannada',
  'TV9 Kannada': 'Kannada', 'Public TV': 'Kannada',
  'News18 Kannada': 'Kannada', 'Suvarna News': 'Kannada',
  'TV5 Kannada': 'Kannada', 'Raj News Kannada': 'Kannada',
  'Power TV': 'Kannada', 'Raj Musix Kannada': 'Kannada',
  // Bengali
  'Colors Bangla': 'Bengali', 'Colors Bangla HD': 'Bengali',
  'ABP Ananda': 'Bengali', 'Aamar Bangla': 'Bengali',
  'Star Jalsha': 'Bengali', 'Zee Bangla': 'Bengali',
  'Sony AATH': 'Bengali', 'Aakaash Aath': 'Bengali',
  'Rupasi Bangla': 'Bengali', 'Enterr10 Bangla': 'Bengali',
  'Enterr 10 Bangla': 'Bengali', 'Khushboo Bangla': 'Bengali',
  'KTV Bangla': 'Bengali', 'Zee 24 Ghanta': 'Bengali',
  'News18 Bangla': 'Bengali', 'TV9 Bangla': 'Bengali',
  'Kolkata TV': 'Bengali', 'Republic Bangla': 'Bengali',
  'NK TV Bangla': 'Bengali', 'Sangeet Bangla': 'Bengali',
  // Marathi
  'Colors Marathi': 'Marathi', 'Colors Marathi HD': 'Marathi',
  'ABP Majha': 'Marathi', 'Zee Marathi': 'Marathi',
  'Star Pravah': 'Marathi', 'Sony Marathi': 'Marathi',
  'Fakt Marathi': 'Marathi', 'Sangeet Marathi': 'Marathi',
  'TV9 Marathi': 'Marathi', 'Zee 24 Taas': 'Marathi',
  'Saam TV': 'Marathi', 'News18 Lokmat': 'Marathi',
  'Lokshahi News': 'Marathi', 'Jai Maharashtra': 'Marathi',
  'NDTV Marathi': 'Marathi', 'Lokshahi Marathi': 'Marathi',
  // Punjabi
  '9X Tashan': 'Punjabi', 'Chardikla Gurbaani TV': 'Punjabi',
  'Chardikla Time TV': 'Punjabi', 'PTC Punjabi': 'Punjabi',
  'PTC Punjabi Gold': 'Punjabi', 'PTC Chakde': 'Punjabi',
  'Zee Punjabi': 'Punjabi', 'MH One': 'Punjabi',
  'Punjabi Hits': 'Punjabi', 'Pitaara': 'Punjabi',
  'PTC News': 'Punjabi', 'Living India News': 'Punjabi',
  'ABP Sanjha': 'Punjabi', 'Rozana Spokesman': 'Punjabi',
  // Gujarati
  'Colors Gujarati': 'Gujarati', 'ABP Asmita': 'Gujarati',
  'Shemaroo Gujarati': 'Gujarati', 'TV9 Gujarati': 'Gujarati',
  'Sandesh News': 'Gujarati', 'GSTV': 'Gujarati', 'GS TV': 'Gujarati',
  'VTV Gujarati': 'Gujarati', 'News18 Gujarati': 'Gujarati',
  'Zee 24 Kalak': 'Gujarati', 'Gujarat First': 'Gujarati',
  // Odia
  'DD Odia': 'Odia', 'OTV': 'Odia', 'Kanak News': 'Odia',
  'Kalinga TV': 'Odia', 'News18 Odia': 'Odia',
  'Nandighosha TV': 'Odia', 'Argus News': 'Odia',
  'Prameya News7': 'Odia', 'Zee Odisha': 'Odia',
  // Assamese / North East
  'News Live': 'Assamese / North East', 'DY 365': 'Assamese / North East',
  'Pratidin Time': 'Assamese / North East', 'North East Live': 'Assamese / North East',
  'Rengoni TV': 'Assamese / North East', 'Jonack TV': 'Assamese / North East',
  'Ramdhenu': 'Assamese / North East', 'Hornbill TV': 'Assamese / North East',
  // Urdu
  'DD Urdu': 'Urdu', 'ETV Urdu': 'Urdu', 'Zee Salaam': 'Urdu',
  'Gulistan News': 'Urdu', 'Munsif TV': 'Urdu', 'Munsif Tv': 'Urdu', 'Salaam TV': 'Urdu',
  // Bhojpuri
  'B4U Bhojpuri': 'Bhojpuri', 'Bhojpuri Cinema': 'Bhojpuri',
  'Zee Biskope': 'Bhojpuri', 'Dabangg': 'Bhojpuri',
  'Oscar Movies Bhojpuri': 'Bhojpuri', 'Mahuaa TV': 'Bhojpuri',
  // English News
  'CNBC TV18': 'English News', 'CNBC TV18 Prime HD': 'English News',
  'India Today': 'English News', 'Times Now': 'English News',
  'Republic TV': 'English News', 'CNN News18': 'English News',
  'NDTV 24x7': 'English News', 'Mirror Now': 'English News',
  'NewsX': 'English News', 'WION': 'English News',
  'ET Now': 'English News', 'NDTV Profit': 'English News',
  'Business Today TV': 'English News',
  // Business News
  'CNBC Awaaz': 'Business News', 'CNBC Bajar': 'Business News',
  'ET Now Swadesh': 'Business News', 'Zee Business': 'Business News',
  'BT TV': 'Business News',
  // Sports
  'Star Sports 1': 'Sports', 'Star Sports 2': 'Sports',
  'Star Sports Hindi': 'Sports', 'Star Sports Select 1': 'Sports',
  'Sony LIV Sports': 'Sports', 'DD Sports': 'Sports',
  'Sports18 1': 'Sports', 'Sports18 Khel': 'Sports',
  'Sony Sports Ten 1': 'Sports', 'Sony Sports Ten 2': 'Sports',
  'Sony Sports Ten 3': 'Sports', 'Sony Sports Ten 5': 'Sports',
  // English Movies
  'Movies Now': 'English Movies', 'MNX': 'English Movies',
  'MNX HD': 'English Movies', 'Romedy Now': 'English Movies',
  'Sony Pix': 'English Movies', 'Star Movies': 'English Movies',
  'Warner TV': 'English Movies', 'Colors Infinity': 'English Movies',
  'Colors Infinity HD': 'English Movies',
};

// App categories
const CATEGORY_ORDER = [
  'Hindi Entertainment', 'Hindi Movies', 'Hindi News', 'English News', 'Business News',
  'Sports', 'Music', 'Kids', 'Devotional', 'Education', 'Doordarshan', 'Tamil',
  'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Punjabi', 'Gujarati',
  'Odia', 'Assamese / North East', 'Urdu', 'Bhojpuri', 'Lifestyle / Infotainment',
  'English Movies', 'International News', 'Free FAST Channels',
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function probeStream(url, userAgent, referrer) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { 'User-Agent': userAgent || USER_AGENT };
    if (referrer) headers['Referer'] = referrer;
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...headers, 'Range': 'bytes=0-2048' },
      signal: controller.signal,
    });
    if (res.status < 200 || res.status >= 400) return false;
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    return ct.includes('mpegurl') || ct.includes('m3u') ||
           url.includes('.m3u8') || text.trimStart().startsWith('#EXTM3U') ||
           text.includes('#EXT-X') || res.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function parseM3U(text) {
  const channels = [];
  const lines = text.split('\n');
  let current = null;
  let extraUserAgent = null;
  let extraReferrer = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('#EXTINF:')) {
      const tvgId = line.match(/tvg-id="([^"]*)"/) ?. [1] || '';
      const tvgName = line.match(/tvg-name="([^"]*)"/) ?. [1] || '';
      const tvgLogo = line.match(/tvg-logo="([^"]*)"/) ?. [1] || '';
      const groupTitle = line.match(/group-title="([^"]*)"/) ?. [1] || 'General';
      const httpUA = line.match(/http-user-agent="([^"]*)"/) ?. [1] || '';
      const httpRef = line.match(/http-referrer="([^"]*)"/) ?. [1] || '';
      const commaIdx = line.lastIndexOf(',');
      const rawDisplay = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      // Strip quality suffix like (576p), (1080p), [Geo-blocked], [Not 24/7]
      const displayName = rawDisplay.replace(/\s*\(\d+[pi]\)\s*$/,'').replace(/\s*\[[^\]]+\]\s*$/, '').trim();

      current = { tvgId, tvgName: tvgName || displayName, displayName, logo: tvgLogo, group: groupTitle, userAgent: httpUA, referrer: httpRef };
      extraUserAgent = null;
      extraReferrer = null;
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      extraUserAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
    } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
      extraReferrer = line.replace('#EXTVLCOPT:http-referrer=', '').trim();
    } else if (line && !line.startsWith('#') && current) {
      const ua = current.userAgent || extraUserAgent || '';
      const ref = current.referrer || extraReferrer || '';
      channels.push({ ...current, url: line, userAgent: ua, referrer: ref });
      current = null;
      extraUserAgent = null;
      extraReferrer = null;
    }
  }
  return channels;
}

function resolveCategory(channel) {
  // Check overrides by display name or tvgName
  for (const name of [channel.displayName, channel.tvgName]) {
    if (name && CHANNEL_CATEGORY_OVERRIDES[name]) {
      return CHANNEL_CATEGORY_OVERRIDES[name];
    }
  }
  // Map group to category
  const groups = channel.group.split(';').map(g => g.trim());
  for (const g of groups) {
    if (GROUP_TO_CATEGORY[g]) return GROUP_TO_CATEGORY[g];
  }
  return 'Free FAST Channels';
}

async function runConcurrent(items, limit, fn) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getOrCreateCategory(name) {
  const sortOrder = CATEGORY_ORDER.indexOf(name) >= 0 ? CATEGORY_ORDER.indexOf(name) + 1 : 99;
  const res = await db.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (res.rows.length > 0) {
    await db.query('UPDATE categories SET status=$1, sort_order=$2 WHERE id=$3', ['active', sortOrder, res.rows[0].id]);
    return res.rows[0].id;
  }
  const ins = await db.query(`INSERT INTO categories (name, icon_url, status, sort_order) VALUES ($1, '', 'active', $2) RETURNING id`, [name, sortOrder]);
  return ins.rows[0].id;
}

async function main() {
  console.log(`\n=== Mass Import from iptv-org India Playlist ===`);
  console.log(`Source: ${INDIA_M3U_URL}`);
  console.log(`Check Streams: ${CHECK_STREAMS}`);
  console.log(`Dry Run: ${DRY_RUN}\n`);

  console.log('Fetching India M3U playlist...');
  const m3uText = await fetchText(INDIA_M3U_URL);
  const allChannels = parseM3U(m3uText);
  console.log(`Parsed ${allChannels.length} channel entries from playlist.\n`);

  // Ensure all categories exist
  if (!DRY_RUN) {
    for (const cat of CATEGORY_ORDER) await getOrCreateCategory(cat);
    console.log(`Categories ready.\n`);
  }

  let toImport = allChannels;

  if (CHECK_STREAMS) {
    console.log(`Probing ${allChannels.length} streams with concurrency=${CONCURRENCY}...\n`);
    let probed = 0;
    const checkResults = await runConcurrent(allChannels, CONCURRENCY, async (ch, i) => {
      const ok = await probeStream(ch.url, ch.userAgent, ch.referrer);
      probed++;
      if (probed % 50 === 0) console.log(`  Probed ${probed}/${allChannels.length}...`);
      if (!ok) {
        console.log(`  ✗ offline: ${ch.displayName || ch.tvgName}`);
        return null;
      }
      console.log(`  ✓ online: ${ch.displayName || ch.tvgName}`);
      return ch;
    });
    toImport = checkResults.filter(Boolean);
    console.log(`\nOnline: ${toImport.length}/${allChannels.length}`);
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN PREVIEW ---');
    for (const ch of toImport) {
      const cat = resolveCategory(ch);
      console.log(`[${cat}] ${ch.displayName || ch.tvgName} → ${ch.url}`);
    }
    console.log(`\nTotal to import: ${toImport.length}`);
    await db.pool.end();
    return;
  }

  let inserted = 0, updated = 0, skipped = 0;

  for (const ch of toImport) {
    const name = ch.displayName || ch.tvgName || 'Unknown';
    if (!name || name === 'Unknown' || !ch.url) { skipped++; continue; }

    const category = resolveCategory(ch);
    const catId = await getOrCreateCategory(category);
    const sourceId = ch.tvgId || `m3u-${name.toLowerCase().replace(/\s+/g, '-')}`;

    try {
      const existing = await db.query(
        `SELECT id FROM channels WHERE source_channel_id = $1 AND source = 'iptv-org-m3u' LIMIT 1`,
        [sourceId]
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE channels SET
            name=$1, logo_url=$2, stream_url=$3, category_id=$4,
            status='active', health_status='online',
            user_agent=$5, referrer=$6,
            updated_at=NOW(), last_checked_at=NOW()
          WHERE id=$7`,
          [name, ch.logo || null, ch.url, catId, ch.userAgent || null, ch.referrer || null, existing.rows[0].id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO channels
            (name, logo_url, stream_url, category_id, language,
             source, source_channel_id, country, status, health_status,
             is_featured, is_premium, quality, user_agent, referrer, last_checked_at)
          VALUES ($1,$2,$3,$4,'Hindi','iptv-org-m3u',$5,'IN','active','online',
            false,false,'SD',$6,$7,NOW())`,
          [name, ch.logo || null, ch.url, catId, sourceId, ch.userAgent || null, ch.referrer || null]
        );
        inserted++;
      }
    } catch (err) {
      console.error(`  Error importing ${name}:`, err.message);
      skipped++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped}`);

  const totalRes = await db.query(`SELECT COUNT(id) FROM channels`);
  const onlineRes = await db.query(`SELECT COUNT(id) FROM channels WHERE health_status = 'online'`);
  console.log(`\nTotal channels in DB: ${totalRes.rows[0].count}`);
  console.log(`Online channels in DB: ${onlineRes.rows[0].count}`);

  await db.pool.end();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await db.pool.end();
  process.exit(1);
});

/**
 * India-Focused IPTV-org Data Import Script
 *
 * Keeps existing app channels intact and imports only Indian-audience target
 * channels that exist in iptv-org's India playlist/API.
 *
 * Usage:
 *   node scripts/import-iptv-org.js --source=in-m3u --limit=none
 *   node scripts/import-iptv-org.js --source=api --limit=none
 *   node scripts/import-iptv-org.js --dry-run --limit=none
 *
 * Options:
 *   --check-streams=false   Skip live stream probes and import matched URLs as unknown.
 *   --dry-run               Print matched/missing/skipped channels without DB writes.
 */

require('dotenv').config();
const db = require('../src/config/db');

const args = process.argv.slice(2);
const options = {
  country: args.find(a => a.startsWith('--country='))?.split('=')[1] || null,
  allIndian: args.includes('--all-indian'),
  limit: args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100',
  includeOffline: args.includes('--include-offline=true'),
  source: args.find(a => a.startsWith('--source='))?.split('=')[1] || 'in-m3u',
  dryRun: args.includes('--dry-run'),
  checkStreams: !args.includes('--check-streams=false'),
};

const REQUEST_TIMEOUT = 12000;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36';
const APIs = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  logos: 'https://iptv-org.github.io/api/logos.json',
  inM3u: 'https://iptv-org.github.io/iptv/countries/in.m3u',
};

const CATEGORY_ORDER = [
  'Hindi Entertainment', 'Hindi Movies', 'Hindi News', 'English News', 'Business News',
  'Sports', 'Music', 'Kids', 'Devotional', 'Education', 'Doordarshan', 'Tamil',
  'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Punjabi', 'Gujarati',
  'Odia', 'Assamese / North East', 'Urdu', 'Bhojpuri', 'Lifestyle / Infotainment',
  'English Movies', 'International News', 'Free FAST Channels', 'General',
];

const TARGET_CHANNELS_BY_CATEGORY = {
  'Doordarshan': ['DD National','DD India','DD Bharati','DD Bangla','DD Chandana','DD News','DD Sports','DD Kisan','DD Urdu','DD Punjabi','DD Girnar','DD Sahyadri','DD Odia','DD Assam','DD Malayalam','DD Tamil','DD Yadagiri','DD Saptagiri','DD Rajasthan','DD Madhya Pradesh','DD Uttar Pradesh','DD Bihar','DD North East','DD Kashir','Sansad TV Lok Sabha','Sansad TV Rajya Sabha'],
  'Hindi News': ['Aaj Tak','Aaj Tak HD','ABP News','News18 India','Zee News','India TV','BT TV','Bharat 24','Republic Bharat','Times Now Navbharat','NDTV India','News Nation','News24','Good News Today','TV9 Bharatvarsh','India News','Live Hindustan','Zee Hindustan','News 1 India','First India News','Hindi Khabar','Khabar Fast','Samachar Plus','Har Khabar','IBC24','INH 24x7'],
  'English News': ['CNBC TV18','CNBC TV18 Prime HD','India Today','Times Now','Republic TV','CNN News18','NDTV 24x7','Mirror Now','NewsX','WION','ET Now','NDTV Profit','Business Today TV'],
  'Business News': ['CNBC Awaaz','CNBC Bajar','CNBC TV18','ET Now Swadesh','Zee Business','NDTV Profit','Business Today TV'],
  'Hindi Entertainment': ['Star Plus','Zee TV','Sony Entertainment','Colors','&TV','Dangal TV','Dangal 2','Sony SAB','Sony Pal','Star Bharat','Shemaroo TV','Shemaroo Umang','Big Magic','Ishara TV','Atrangii','Enterr10','Manoranjan TV','Nazara TV','The Q'],
  'Hindi Movies': ['Zee Cinema','Sony Max','Star Gold','Colors Cineplex','Bhojpuri Cinema','Sony Wah','Sony Max 2','Star Gold 2','Star Gold Select','Star Gold Thrills','Zee Bollywood','Zee Action','B4U Movies','Enterr10 Movies','Dhinchaak','Shemaroo Bollywood','Goldmines','Goldmines Movies','Movie Plus'],
  'Bhojpuri': ['B4U Bhojpuri','Bhojpuri Cinema','Zee Biskope','Filamchi Bhojpuri','Dabangg','Oscar Movies Bhojpuri','Mahuaa TV'],
  'Sports': ['Star Sports 1','Star Sports 2','Star Sports Hindi','Star Sports Select 1','Sony LIV Sports','DD Sports','Sports18 1','Sports18 Khel','Sony Sports Ten 1','Sony Sports Ten 2','Sony Sports Ten 3','Sony Sports Ten 5','Star Sports 1 Hindi','Star Sports Select 2'],
  'Music': ['9XM','9X Jalwa','9X Jhakaas','9X Tashan','Balle Balle','B4U Music','Mastiii','Zing','Zoom','E24','MTV Beats','Music India','ShowBox','Sangeet Bangla','Sangeet Marathi','PTC Chakde','PTC Music','Raj Musix Tamil','Raj Musix Telugu','Raj Musix Kannada','Raj Musix Malayalam','Isai Aruvi','Jaya Max'],
  'Kids': ['Pogo','Cartoon Network','Nickelodeon','Nick HD+','Sonic','Sony YAY','Hungama TV','Disney Channel','Disney Junior','Discovery Kids','Disney Stories'],
  'Devotional': ['Aastha','Aastha Bhajan','Aastha Prime 1','Sanskar TV','Satsang TV','Shubh TV','Divya TV','Paras TV','Peace of Mind TV','Hare Krsna TV','Ishwar TV','Jinvani Channel','Arihant TV','MH One Shraddha','Sadhna TV','SVBC','SVBC 2','Bhakti TV','Hindu Dharmam','Sankara TV','Nambikkai TV','Madha TV','Goodness TV'],
  'Education': ['Swayam Prabha','PM eVidya','DD Gyan Darshan','Gyan Darshan','NIOS Channel','NCERT Channel','DigiShala','Vyas Higher Education Channel'],
  'Tamil': ['Star Vijay','Sun TV','Colors Tamil HD','Aaryaa TV','Zee Tamil','Colors Tamil','Jaya TV','Kalaignar TV','Raj TV','Makkal TV','Polimer TV','Puthuyugam TV','Vendhar TV','Captain TV','Sirippoli TV','Thanthi TV','Puthiya Thalaimurai','News7 Tamil','Polimer News','Sun News','Kalaignar Seithigal','Jaya Plus','Sathiyam TV','Raj News Tamil','Malai Murasu TV'],
  'Telugu': ['Star Maa','Zee Telugu','ABN Andhra Jyoti','10 TV','ETV Telugu','Gemini TV','ETV Cinema','ETV Plus','ETV Life','ETV Abhiruchi','ETV Andhra Pradesh','ETV Telangana','Raj TV Telugu','TV9 Telugu','NTV Telugu','Sakshi TV','ABN Andhra Jyothy','V6 News','TV5 News','10TV Telugu','T News','Mahaa News','Prime9 News','HMTV'],
  'Malayalam': ['Asianet','Asianet News','Asianet Movies','Asianet Plus','Amrita TV','Mazhavil Manorama','Surya TV','Flowers TV','Kairali TV','Kairali We','Jaihind TV','Kaumudy TV','Kappa TV','Manorama News','Mathrubhumi News','24 News','Reporter TV','Kairali News','MediaOne TV','Janam TV','News18 Kerala','Real News Kerala'],
  'Kannada': ['Colors Kannada','Colors Kannada HD','Colors Kannada Cinema','Asianet Suvarna News','Zee Kannada','Udaya TV','Star Suvarna','Colors Super','Udaya Movies','Udaya Music','Raj Musix Kannada','TV9 Kannada','Public TV','News18 Kannada','Suvarna News','BTV Kannada','Dighvijay News','TV5 Kannada','News First Kannada','Raj News Kannada','Power TV'],
  'Bengali': ['Colors Bangla','Colors Bangla HD','ABP Ananda','Aamar Bangla','Star Jalsha','Zee Bangla','Sony AATH','Aakash Aath','Rupasi Bangla','Enterr10 Bangla','Khushboo Bangla','KTV Bangla','Zee 24 Ghanta','News18 Bangla','TV9 Bangla','Kolkata TV','Calcutta News','Republic Bangla','R Plus News','NewsTime Bangla','NK TV Bangla'],
  'Marathi': ['Colors Marathi','Colors Marathi HD','ABP Majha','Zee Marathi','Star Pravah','Sony Marathi','Fakt Marathi','Shemaroo Marathi Bana','Sangeet Marathi','Pravah Picture','TV9 Marathi','Zee 24 Taas','Saam TV','News18 Lokmat','Lokshahi Marathi','Jai Maharashtra','NDTV Marathi'],
  'Punjabi': ['9X Tashan','Chardikla Gurbaani TV','Chardikla Time TV','PTC Punjabi','PTC Punjabi Gold','PTC Chakde','Zee Punjabi','MH One','MH One Dil Se','Punjabi Hits','Pitaara','PTC News','MH One News','Living India News','Rozana Spokesman'],
  'Gujarati': ['Colors Gujarati','ABP Asmita','Shemaroo Gujarati','DD Girnar','TV9 Gujarati','Sandesh News','GSTV','VTV Gujarati','News18 Gujarati','Zee 24 Kalak','Gujarat First','CNBC Bajar'],
  'Odia': ['DD Odia','OTV','Kanak News','Kalinga TV','News18 Odia','Nandighosha TV','Argus News','Prameya News7','Zee Odisha'],
  'Assamese / North East': ['DD Assam','News Live','Prag News','DY365','Pratidin Time','North East Live','Rengoni TV','Jonack TV','Ramdhenu','NKTV','Hornbill TV','NE News'],
  'Urdu': ['DD Urdu','ETV Urdu','Zee Salaam','Gulistan News','Munsif TV','Salaam TV'],
  'Lifestyle / Infotainment': ['Discovery Channel','Discovery Science','Discovery Turbo','History TV18','National Geographic','Nat Geo Wild','TLC','Food Food','NDTV Good Times','Epic TV'],
  'English Movies': ['Movies Now','MNX','MNX HD','Romedy Now','Sony Pix','Star Movies','Star Movies Select','Warner TV','Colors Infinity'],
  'International News': ['BBC World News','Al Jazeera English','DW English','France 24 English','NHK World Japan','TRT World','CNA'],
  'Free FAST Channels': ['Shemaroo Josh','Shemaroo Bollywood','Chumbak TV','The Q','Goldmines','Goldmines Movies','South Station','Desi Channel','Mango TV','Public Movies','Public Music'],
};

const CHANNEL_ALIASES = {
  'ABN Andhra Jyoti': ['ABN Andhra Jyothy'],
  'ABN Andhra Jyothy': ['ABN Andhra Jyoti'],
  'Aaj Tak HD': ['Aaj Tak'],
  'CNBC TV18': ['CNBC TV18', 'CNBC-TV18'],
  'CNN News18': ['CNN-News18'],
  'DD Odia': ['DD Oriya'],
  'DD Saptagiri': ['DD Telugu'],
  'DD Yadagiri': ['DD Telangana'],
  'DD Girnar': ['DD Gujarati'],
  'DD Sahyadri': ['DD Marathi'],
  'News24': ['News 24'],
  'News 1 India': ['News1 India'],
  'Sony SAB': ['SAB TV'],
  'Sony Entertainment': ['Sony Entertainment Television', 'SET India'],
  'Sony Max': ['Sony MAX'],
  'Sony Max 2': ['Sony MAX 2'],
  'Sports18 1': ['Sports 18 1'],
  'Sports18 Khel': ['Sports 18 Khel'],
  'Star Sports 1 Hindi': ['Star Sports 1 Hindi HD', 'Star Sports Hindi'],
  'Star Sports Select 1': ['Star Sports Select 1 HD'],
  'Star Sports Select 2': ['Star Sports Select 2 HD'],
  'Times Now Navbharat': ['Times Now Navbharat HD'],
  'TV5 News': ['TV5 Telugu News'],
  '10 TV': ['10TV Telugu', '10TV'],
  '10TV Telugu': ['10 TV', '10TV'],
  'Zee 24 Ghanta': ['Zee 24 Ghanta TV'],
  'Zee 24 Taas': ['Zee 24 Taas HD'],
  '&TV': ['And TV', '& TV'],
};

function normalizeName(value, dropQuality = true) {
  let normalized = (value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ');
  if (dropQuality) {
    normalized = normalized.replace(/\b(hd|sd|fhd|uhd|4k|live|tv|channel)\b/g, ' ');
  } else {
    normalized = normalized.replace(/\b(live|tv|channel)\b/g, ' ');
  }
  return normalized
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const targetByExactName = new Map();
const targetByNormalizedName = new Map();
for (const [category, names] of Object.entries(TARGET_CHANNELS_BY_CATEGORY)) {
  for (const name of names) {
    for (const alias of [name, ...(CHANNEL_ALIASES[name] || [])]) {
      const exactAlias = normalizeName(alias, false);
      const normalizedAlias = normalizeName(alias);
      if (!targetByExactName.has(exactAlias)) {
        targetByExactName.set(exactAlias, { name, category });
      }
      if (!targetByNormalizedName.has(normalizedAlias)) {
        targetByNormalizedName.set(normalizedAlias, { name, category });
      }
    }
  }
}

function findTargetChannel(channel) {
  const candidates = [channel.name, channel.rawName, channel.tvgName, channel.id, (channel.id || '').replace(/(@.+|\.[a-z]{2,3})$/i, '')];
  for (const value of candidates) {
    const target = targetByExactName.get(normalizeName(value, false));
    if (target) return target;
  }
  for (const value of candidates) {
    const target = targetByNormalizedName.get(normalizeName(value));
    if (target) return target;
  }
  return null;
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
    return null;
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
    return null;
  }
}

function baseChannelId(tvgId) {
  return (tvgId || '').replace(/@.+$/, '');
}

function cleanDisplayName(name) {
  return (name || 'Unknown').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

function headersForStream(channel) {
  const headers = { 'User-Agent': channel.userAgent || USER_AGENT };
  if (channel.referrer) headers.Referer = channel.referrer;
  return headers;
}

async function probe(url, method, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      method,
      headers: method === 'GET' ? { ...headers, Range: 'bytes=0-2048' } : headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = method === 'GET' ? await response.text() : '';
    return { ok: response.status >= 200 && response.status < 400, status: response.status, contentType, body: body.slice(0, 4096) };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeHls(url, result) {
  const contentType = (result.contentType || '').toLowerCase();
  const body = result.body || '';
  return contentType.includes('mpegurl') || contentType.includes('m3u') || url.toLowerCase().includes('.m3u8') || body.trimStart().startsWith('#EXTM3U') || body.includes('#EXT-X-VERSION') || body.includes('#EXT-X-STREAM-INF') || body.includes('#EXT-X-TARGETDURATION');
}

async function checkStream(channel) {
  if (!channel.url || !channel.url.startsWith('http')) return { ok: false, error: 'invalid_url' };
  const headers = headersForStream(channel);
  const head = await probe(channel.url, 'HEAD', headers);
  if (head.ok && looksLikeHls(channel.url, head)) return { ok: true, method: 'HEAD' };
  const get = await probe(channel.url, 'GET', headers);
  if (get.ok && looksLikeHls(channel.url, get)) return { ok: true, method: 'GET' };
  return { ok: false, error: get.error || head.error || `HTTP_${get.status || head.status || 'unknown'}` };
}

async function runWithConcurrency(items, limit, fn) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getOrCreateCategory(catName) {
  const name = catName || 'General';
  const sortOrder = CATEGORY_ORDER.indexOf(name) >= 0 ? CATEGORY_ORDER.indexOf(name) + 1 : 0;
  const res = await db.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (res.rows.length > 0) {
    await db.query('UPDATE categories SET status = $1, sort_order = $2 WHERE id = $3', ['active', sortOrder, res.rows[0].id]);
    return res.rows[0].id;
  }
  const insertRes = await db.query(`INSERT INTO categories (name, icon_url, status, sort_order) VALUES ($1, '', 'active', $2) RETURNING id`, [name, sortOrder]);
  return insertRes.rows[0].id;
}

async function ensureCategories() {
  for (const category of CATEGORY_ORDER) await getOrCreateCategory(category);
}

async function loadApiMetadata() {
  console.log('Fetching channels, streams, and logos from API...');
  const [channelsData, streamsData, logosData] = await Promise.all([fetchJSON(APIs.channels), fetchJSON(APIs.streams), fetchJSON(APIs.logos)]);
  const logoMap = new Map();
  if (logosData) logosData.forEach(l => { if (l.channel && l.url) logoMap.set(l.channel, l.url); });
  const metadataById = new Map();
  if (channelsData) {
    channelsData.forEach(c => {
      if (!c.id) return;
      metadataById.set(c.id, {
        name: c.name,
        logo: logoMap.get(c.id) || c.logo,
        category: (c.categories && c.categories.length > 0) ? c.categories[0] : 'General',
        language: (c.languages && c.languages.length > 0) ? c.languages[0] : 'Unknown',
        isIndia: (c.countries && c.countries.includes('IN')) || c.country === 'IN' || (c.broadcast_area && c.broadcast_area.includes('c/IN')),
      });
    });
  }
  const streamsById = new Map();
  if (streamsData) {
    streamsData.forEach(s => {
      if (!s.channel || !s.url || streamsById.has(s.channel)) return;
      streamsById.set(s.channel, { url: s.url, quality: s.quality || 'SD', userAgent: s.user_agent, referrer: s.referrer });
    });
  }
  return { metadataById, streamsById };
}

async function parseM3uSource(metadataById = new Map(), streamsById = new Map()) {
  console.log(`Fetching M3U from ${APIs.inM3u}...`);
  const text = await fetchText(APIs.inM3u);
  if (!text) return [];
  const channels = [];
  let currentChannel = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const commaIndex = line.lastIndexOf(',');
      const rawName = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : null;
      const id = tvgIdMatch && tvgIdMatch[1] ? tvgIdMatch[1] : null;
      const channelId = baseChannelId(id);
      const tvgName = tvgNameMatch && tvgNameMatch[1] ? tvgNameMatch[1] : null;
      const metadata = metadataById.get(channelId) || {};
      const streamMeta = streamsById.get(channelId) || {};
      currentChannel = {
        id: channelId || id || cleanDisplayName(tvgName || rawName),
        sourceId: id || channelId || cleanDisplayName(tvgName || rawName),
        playlistId: id,
        name: cleanDisplayName(tvgName || rawName || metadata.name || 'Unknown'),
        rawName,
        tvgName,
        logo: tvgLogoMatch ? tvgLogoMatch[1] : metadata.logo,
        group: groupTitleMatch ? groupTitleMatch[1] : 'General',
        language: metadata.language || 'Unknown',
        quality: streamMeta.quality || (rawName?.match(/\(([^)]*p)\)/i)?.[1]) || 'SD',
        userAgent: streamMeta.userAgent,
        referrer: streamMeta.referrer,
      };
    } else if (line.trim() !== '' && !line.startsWith('#') && currentChannel) {
      currentChannel.url = line.trim();
      channels.push(currentChannel);
      currentChannel = null;
    }
  }
  return channels;
}

async function parseApiSource(metadataById, streamsById) {
  const m3uText = await fetchText(APIs.inM3u);
  const indiaPlaylistIds = new Set();
  const indiaPlaylistUrls = new Set();
  if (m3uText) {
    let currentId = null;
    m3uText.split('\n').forEach(line => {
      if (line.startsWith('#EXTINF:')) {
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        currentId = baseChannelId(tvgIdMatch?.[1]);
      } else if (line.trim() !== '' && !line.startsWith('#')) {
        if (currentId) indiaPlaylistIds.add(currentId);
        indiaPlaylistUrls.add(line.trim());
        currentId = null;
      }
    });
  }
  const channels = [];
  for (const [id, stream] of streamsById.entries()) {
    const metadata = metadataById.get(id) || {};
    const inIndiaPlaylist = indiaPlaylistIds.has(id) || indiaPlaylistUrls.has(stream.url);
    const isIndianCandidate = inIndiaPlaylist || metadata.isIndia || options.allIndian || options.country === 'IN';
    if (!isIndianCandidate || !stream.url) continue;
    channels.push({
      id,
      name: cleanDisplayName(metadata.name || id),
      rawName: metadata.name || id,
      logo: metadata.logo,
      group: metadata.category || 'General',
      language: metadata.language || 'Unknown',
      quality: stream.quality,
      userAgent: stream.userAgent,
      referrer: stream.referrer,
      url: stream.url,
    });
  }
  return channels;
}

function scoreCandidate(channel) {
  let score = 0;
  if (channel.logo) score += 1;
  if (channel.language && channel.language !== 'Unknown') score += 1;
  if (channel.quality && /1080|720|HD/i.test(channel.quality)) score += 1;
  if (channel.playlistId) score += 1;
  return score;
}

function chooseBestCandidate(existing, candidate) {
  if (!existing) return candidate;
  return scoreCandidate(candidate) > scoreCandidate(existing) ? candidate : existing;
}

function applyTargetFilter(channels) {
  const matched = new Map();
  for (const channel of channels) {
    const target = findTargetChannel(channel);
    if (!target) continue;
    const candidate = { ...channel, name: target.name, category: target.category, targetKey: `${target.category}:${target.name}` };
    matched.set(candidate.targetKey, chooseBestCandidate(matched.get(candidate.targetKey), candidate));
  }
  return Array.from(matched.values());
}

async function filterWorkingStreams(channels) {
  if (!options.checkStreams) return channels.map(channel => ({ ...channel, healthStatus: 'unknown' }));
  console.log(`Checking ${channels.length} matched stream(s)...`);
  const checked = await runWithConcurrency(channels, 8, async (channel) => {
    const result = await checkStream(channel);
    if (!result.ok) {
      console.log(`  skipped offline: ${channel.name} (${result.error || 'not_hls'})`);
      return null;
    }
    console.log(`  online: ${channel.name}`);
    return { ...channel, healthStatus: 'online' };
  });
  return checked.filter(Boolean);
}

function printTargetCoverage(channels) {
  const foundNames = new Set(channels.map(c => c.name));
  const targetByName = new Map();
  for (const [category, names] of Object.entries(TARGET_CHANNELS_BY_CATEGORY)) {
    names.forEach(name => {
      if (!targetByName.has(name)) targetByName.set(name, { name, categories: [] });
      targetByName.get(name).categories.push(category);
    });
  }
  const missing = Array.from(targetByName.values()).filter(target => !foundNames.has(target.name));
  console.log(`Unique target channels listed: ${targetByName.size}`);
  console.log(`Matched in iptv-org India/API: ${channels.length}`);
  console.log(`Not present/matched in iptv-org: ${missing.length}`);
  if (options.dryRun && missing.length > 0) {
    console.log('\nMissing target channels:');
    missing.forEach(target => console.log(`  - ${target.categories.join(' / ')}: ${target.name}`));
  }
}

async function importIPTVData() {
  console.log('=== IPTV Import Started ===');
  console.log('Options:', options);
  const { metadataById, streamsById } = await loadApiMetadata();
  let channels = options.source === 'api'
    ? await parseApiSource(metadataById, streamsById)
    : await parseM3uSource(metadataById, streamsById);
  console.log(`Total channels found in source: ${channels.length}`);
  channels = applyTargetFilter(channels);
  printTargetCoverage(channels);
  if (options.limit !== 'none') {
    const limit = parseInt(options.limit, 10);
    if (!isNaN(limit)) {
      channels = channels.slice(0, limit);
      console.log(`Limited to ${channels.length} matched channels`);
    }
  }
  channels = await filterWorkingStreams(channels);
  console.log(`Working target channels ready to import: ${channels.length}`);
  if (options.dryRun) {
    console.log('\nDry run matched channels:');
    channels.forEach(c => console.log(`  - ${c.category}: ${c.name} [${c.quality || 'SD'}] ${c.url}`));
    await db.pool.end();
    return;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let invalidUrls = 0;
  await ensureCategories();
  for (const c of channels) {
    if (!c.url || !c.url.startsWith('http')) {
      invalidUrls++;
      continue;
    }
    const categoryId = await getOrCreateCategory(c.category);
    const existing = await db.query('SELECT id FROM channels WHERE source_channel_id = $1 AND source = $2 LIMIT 1', [c.sourceId || c.id, 'iptv-org']);
    try {
      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE channels SET
            name=$1, logo_url=$2, stream_url=$3, category_id=$4, language=$5,
            status=$6, health_status=$7, quality=$8, user_agent=$9, referrer=$10,
            country=$11, updated_at=NOW(), last_checked_at=NOW()
           WHERE id=$12`,
          [c.name, c.logo, c.url, categoryId, c.language, 'active', c.healthStatus || 'unknown', c.quality || 'SD', c.userAgent || null, c.referrer || null, 'IN', existing.rows[0].id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO channels
            (name, logo_url, stream_url, category_id, language, source_channel_id,
             source, country, status, health_status, is_featured, is_premium,
             quality, user_agent, referrer, last_checked_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             false, false, $11, $12, $13, NOW())`,
          [c.name, c.logo, c.url, categoryId, c.language, c.sourceId || c.id, 'iptv-org', 'IN', 'active', c.healthStatus || 'unknown', c.quality || 'SD', c.userAgent || null, c.referrer || null]
        );
        inserted++;
      }
    } catch (err) {
      console.error(`Error importing ${c.name}:`, err.message);
      skipped++;
    }
  }
  console.log('\n=== Import Summary ===');
  console.log(`Total parsed: ${channels.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (errors/dupes): ${skipped}`);
  console.log(`Skipped (invalid URLs): ${invalidUrls}`);
  const totalInDbRes = await db.query(`SELECT COUNT(*) FROM channels WHERE country = 'IN' OR country = 'India'`);
  console.log(`Total Indian channels in database: ${totalInDbRes.rows[0].count}`);
  await db.pool.end();
}

importIPTVData().catch(async (err) => {
  console.error('Import failed:', err);
  await db.pool.end();
  process.exit(1);
});

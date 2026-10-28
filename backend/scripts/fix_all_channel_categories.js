'use strict';
/**
 * fix_all_channel_categories.js
 *
 * Categorizes all channels into the 11 active genre categories:
 * - News (1)
 * - Sports (2)
 * - Movies (3)
 * - Music (4)
 * - Kids (5)
 * - Entertainment (6)
 * - Regional (7)
 * - Devotional (19)
 * - Business (135)
 * - Lifestyle (136)
 * - General (132)
 *
 * Deactivates all language-named categories and legacy duplicate categories.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

// Exact target category IDs in iptv_db
const CAT = {
  NEWS: 1,
  SPORTS: 2,
  MOVIES: 3,
  MUSIC: 4,
  KIDS: 5,
  ENTERTAINMENT: 6,
  REGIONAL: 7,
  DEVOTIONAL: 19,
  BUSINESS: 135,
  LIFESTYLE: 136,
  GENERAL: 132,
};

function classifyChannel(name, curCatName, groupTitle, language) {
  const n = (name || '').toLowerCase();
  const c = (curCatName || '').toLowerCase();
  const g = (groupTitle || '').toLowerCase();
  const combined = `${n} | ${c} | ${g}`;

  // 1. SPORTS
  if (
    combined.includes('sport') || combined.includes('cricket') || combined.includes('football') ||
    combined.includes('kabaddi') || combined.includes('wrestling') || combined.includes('khel') ||
    n.includes('eurosport') || n.includes('ten sports') || n.includes('ptv sports') ||
    n.includes('a sports') || n.includes('geo super')
  ) {
    return { id: CAT.SPORTS, name: 'Sports' };
  }

  // 2. KIDS
  if (
    combined.includes('kids') || combined.includes('kidz') || combined.includes('cartoon') ||
    combined.includes('animation') || combined.includes('pogo') || combined.includes('hungama') ||
    combined.includes('sonic') || combined.includes('nickelodeon') || combined.includes('nick') ||
    combined.includes('disney') || combined.includes('chithiram') || combined.includes('junior') ||
    combined.includes('toons') || combined.includes('gulli')
  ) {
    return { id: CAT.KIDS, name: 'Kids' };
  }

  // 3. MUSIC
  if (
    combined.includes('music') || combined.includes('sangeet') || combined.includes('gaana') ||
    combined.includes('mastiii') || combined.includes('9xm') || combined.includes('9x ') ||
    combined.includes('b4u music') || combined.includes('zing') || combined.includes('mtv') ||
    combined.includes('zoom') || combined.includes('isai') || combined.includes('isai aruvi') ||
    combined.includes('7s music') || combined.includes('tunes') || combined.includes('sur sangeet') ||
    combined.includes('balle balle') || combined.includes('tarang music') || combined.includes('raj musix') ||
    combined.includes('mh one') || n.includes('ramdhenu') || n.includes('spondon')
  ) {
    return { id: CAT.MUSIC, name: 'Music' };
  }

  // 4. BUSINESS
  if (
    combined.includes('business') || combined.includes('market') || combined.includes('money') ||
    combined.includes('cnbc') || combined.includes('et now') || combined.includes('capital market') ||
    combined.includes('profit') || n.includes('zee business')
  ) {
    return { id: CAT.BUSINESS, name: 'Business' };
  }

  // 5. MOVIES / CINEMA
  if (
    combined.includes('movie') || combined.includes('cinema') || combined.includes('talkies') ||
    combined.includes('film') || combined.includes('filam') || combined.includes('cine') ||
    combined.includes('pictures') || combined.includes('box office') || n.includes('star gold') ||
    n.includes('sony max') || n.includes('zee cinema') || n.includes('b4u movies') ||
    n.includes('colors cineplex') || n.includes('manoranjan movies') || n.includes('manoranjan prime') ||
    n.includes('zee action') || n.includes('zee bollywood') || n.includes('zee classic') ||
    n.includes('bhojpuri cinema') || n.includes('b4u kadak') || n.includes('bs film') ||
    n.includes('captain') || n.includes('cine jomjomat')
  ) {
    return { id: CAT.MOVIES, name: 'Movies' };
  }

  // 6. DEVOTIONAL / RELIGIOUS
  if (
    combined.includes('devotion') || combined.includes('religio') || combined.includes('bhakti') ||
    combined.includes('spiritual') || combined.includes('aastha') || combined.includes('sanskar') ||
    combined.includes('sadhna') || combined.includes('satsang') || combined.includes('gurbani') ||
    combined.includes('fateh tv') || combined.includes('amrit gurbani') || combined.includes('charhdikla') ||
    combined.includes('peace tv') || combined.includes('madani') || combined.includes('calvary') ||
    combined.includes('subhavaartha') || combined.includes('hare krsna') || combined.includes('vedic') ||
    combined.includes('darshan') || combined.includes('sankara') || combined.includes('arihant') ||
    combined.includes('paras') || combined.includes('jinvani') || combined.includes('divya') ||
    combined.includes('shubh') || combined.includes('sharnam') || combined.includes('lord') ||
    combined.includes('jesus') || combined.includes('god') || combined.includes('islam') ||
    combined.includes('quran') || combined.includes('namaz') || combined.includes('prarthana') ||
    combined.includes('ishwar') || combined.includes('arputhar') || combined.includes('madha tv') ||
    combined.includes('mahimai') || combined.includes('sathiyam') || combined.includes('verbum') ||
    combined.includes('hosanna') || combined.includes('hebron') || combined.includes('aaseervatham') ||
    combined.includes('bhagyam') || combined.includes('sai tv') || combined.includes('sairam') ||
    combined.includes('sivan tv') || combined.includes('dukh nivaran') || combined.includes('sikh') ||
    combined.includes('deen tv') || combined.includes('jeremiah') || combined.includes('doyel tv') ||
    combined.includes('astroscience') || combined.includes('anmol tv')
  ) {
    return { id: CAT.DEVOTIONAL, name: 'Devotional' };
  }

  // 7. LIFESTYLE / COOKING / HEALTH / INFOTAINMENT
  if (
    combined.includes('lifestyle') || combined.includes('cooking') || combined.includes('cook') ||
    combined.includes('kitchen') || combined.includes('masala tv') || combined.includes('travel') ||
    combined.includes('fashion') || combined.includes('living') || combined.includes('health') ||
    combined.includes('care') || combined.includes('fitness') || combined.includes('recipe') ||
    combined.includes('khana') || n.includes('cvr health') || n.includes('etv life') ||
    n.includes('food')
  ) {
    return { id: CAT.LIFESTYLE, name: 'Lifestyle' };
  }

  // 8. NEWS
  if (
    combined.includes('news') || combined.includes('samachar') || combined.includes('khabar') ||
    combined.includes('24x7') || combined.includes('24 ghanta') || combined.includes('24 kalak') ||
    combined.includes('24 live') || combined.includes('live 24') || combined.includes('tv9') ||
    combined.includes('abp') || combined.includes('zee news') || combined.includes('ndtv') ||
    combined.includes('aaj tak') || combined.includes('tez') || combined.includes('india today') ||
    combined.includes('times now') || combined.includes('mirror now') || combined.includes('republic') ||
    combined.includes('wion') || combined.includes('sansad') || combined.includes('taaza tv') ||
    combined.includes('raftaar') || combined.includes('prag news') || combined.includes('asom live') ||
    combined.includes('dy365') || combined.includes('dighanta') || combined.includes('first india') ||
    combined.includes('bharat 24') || combined.includes('samaa') || combined.includes('geo news') ||
    combined.includes('ary news') || combined.includes('bol news') || combined.includes('dunya news') ||
    combined.includes('92 news') || combined.includes('hum news') || combined.includes('public tv') ||
    combined.includes('v6 news') || combined.includes('t news') || combined.includes('sakshi tv') ||
    combined.includes('10 tv') || combined.includes('99tv') || combined.includes('apn news') ||
    combined.includes('kashish') || combined.includes('news nation') || combined.includes('news state') ||
    combined.includes('punjab kesari') || combined.includes('sandesh') || combined.includes('mantavya') ||
    combined.includes('gstv') || combined.includes('vtv') || combined.includes('puthiya thalaimurai') ||
    combined.includes('polimer') || combined.includes('thanthi tv') || combined.includes('seithigal') ||
    combined.includes('jan tv') || combined.includes('weatherspy') || combined.includes('ekhon tv') ||
    combined.includes('ion tv') || combined.includes('matribhumi') || combined.includes('r plus') ||
    combined.includes('vokta tv') || combined.includes('rajdhani tv') || combined.includes('aryan tv') ||
    combined.includes('diya tv') || combined.includes('ekamra') || combined.includes('news 11') ||
    combined.includes('tag tv') || combined.includes('tbn tv') || combined.includes('berita') ||
    combined.includes('tamil janam') || combined.includes('tamilan tv') || combined.includes('aathavan') ||
    combined.includes('madhimugam') || combined.includes('makkal tv') || combined.includes('m nadu')
  ) {
    return { id: CAT.NEWS, name: 'News' };
  }

  // 9. REGIONAL (Doordarshan state channels & educational public feeds)
  if (
    n.startsWith('dd ') || n.includes('doordarshan') || n.includes('e-vidya') ||
    n.includes('gyandarshan') || n.includes('shiksha tv') || n.includes('vtu') ||
    n.includes('deshebideshe') || n.includes('jonmobhumi') || n.includes('kantipur') ||
    n.includes('discover pakistan') || n.includes('mithila')
  ) {
    return { id: CAT.REGIONAL, name: 'Regional' };
  }

  // 10. ENTERTAINMENT (Default for general TV, serials, drama, soaps, networks)
  // Sony, Star, Colors, Zee, Geo, Hum, ARY, PTC, Sun, ETV, Jaya, Kalaignar, Dangal, etc.
  if (
    combined.includes('entertain') || combined.includes('drama') || combined.includes('serial') ||
    combined.includes('comedy') || combined.includes('sony') || combined.includes('star') ||
    combined.includes('colors') || combined.includes('zee') || combined.includes('sab tv') ||
    combined.includes('dangal') || combined.includes('geo') || combined.includes('hum tv') ||
    combined.includes('ary digital') || combined.includes('ptc') || combined.includes('sun tv') ||
    combined.includes('etv') || combined.includes('jaya') || combined.includes('kalaignar') ||
    combined.includes('raj tv') || combined.includes('shemaroo') || combined.includes('anmol') ||
    combined.includes('rishtey') || combined.includes('alright') || combined.includes('epic') ||
    combined.includes('discovery') || combined.includes('animal planet') || combined.includes('nat geo') ||
    combined.includes('history') || combined.includes('investigation') || combined.includes('tlc') ||
    combined.includes('zindagi') || combined.includes('apna channel') || combined.includes('atv') ||
    combined.includes('jonack') || combined.includes('pear tv') || combined.includes('rang') ||
    combined.includes('rengoni') || combined.includes('boishakhi') || combined.includes('ananda tv') ||
    combined.includes('gazi tv') || combined.includes('u bangla') || combined.includes('rupasi bangla') ||
    combined.includes('studio yuva') || combined.includes('vanitha tv') || combined.includes('vissa tv') ||
    combined.includes('win tv') || combined.includes('yet tv') || combined.includes('thalaa tv') ||
    combined.includes('vasanth tv') || combined.includes('velicham') || combined.includes('vendhar') ||
    combined.includes('big ganga') || combined.includes('b4u') || combined.includes('manoranjan') ||
    combined.includes('pasand') || combined.includes('mahaa max') || combined.includes('mango mobile') ||
    combined.includes('hyder tv') || combined.includes('rongeen tv') || combined.includes('deshi tv') ||
    combined.includes('green tv') || combined.includes('ktv bangla') || combined.includes('my tv') ||
    combined.includes('ntv') || combined.includes('nexus tv') || combined.includes('rtv') ||
    combined.includes('bangla vision') || combined.includes('channel s') || combined.includes('atn bangla') ||
    combined.includes('vijay takkar') || combined.includes('village tv') || combined.includes('ultimate tv') ||
    combined.includes('vaanavil') || combined.includes('thendral') || combined.includes('suriyan') ||
    combined.includes('suriya') || combined.includes('subin') || combined.includes('sooriyan') ||
    combined.includes('sirippoli') || combined.includes('shakthi') || combined.includes('sana') ||
    combined.includes('mk six') || combined.includes('life tv') || combined.includes('joy tv') ||
    combined.includes('imai tv') || combined.includes('ibc') || combined.includes('eet tv') ||
    combined.includes('dhool') || combined.includes('dharsan') || combined.includes('asia tv') ||
    combined.includes('aaryaa') || combined.includes('amn tv') || combined.includes('aurLife') ||
    combined.includes('bstv') || combined.includes('eawaz') || combined.includes('kay2') ||
    combined.includes('play entertainment') || combined.includes('raavi') || combined.includes('tv one')
  ) {
    return { id: CAT.ENTERTAINMENT, name: 'Entertainment' };
  }

  // 11. GENERAL fallback
  return { id: CAT.GENERAL, name: 'General' };
}

async function fixCategories() {
  console.log('=== Categorizing All Channels into Standard Genres ===\n');

  // Deactivate language-named categories and legacy duplicate categories
  const legacyCatNames = [
    'Hindi Entertainment', 'Hindi Movies', 'Hindi News', 'English News',
    'Religious', 'Documentary', 'Tamil', 'Telugu', 'Bengali', 'Punjabi',
    'Gujarati', 'Urdu', 'Assamese', 'Bhojpuri', 'Odia', 'Doordarshan',
    'International', 'International News', 'Lifestyle / Infotainment',
    'English Movies', 'Free FAST Channels', 'Assamese / North East'
  ];

  await db.query(`
    UPDATE categories SET status = 'inactive'
    WHERE name = ANY($1::text[])
  `, [legacyCatNames]);

  // Ensure active standard categories have active status and proper sort_order
  const activeCategories = [
    { id: CAT.ENTERTAINMENT, name: 'Entertainment', sort: 1 },
    { id: CAT.MOVIES,        name: 'Movies',        sort: 2 },
    { id: CAT.NEWS,          name: 'News',          sort: 3 },
    { id: CAT.SPORTS,        name: 'Sports',        sort: 4 },
    { id: CAT.MUSIC,         name: 'Music',         sort: 5 },
    { id: CAT.DEVOTIONAL,    name: 'Devotional',    sort: 6 },
    { id: CAT.KIDS,          name: 'Kids',          sort: 7 },
    { id: CAT.BUSINESS,      name: 'Business',      sort: 8 },
    { id: CAT.REGIONAL,      name: 'Regional',      sort: 9 },
    { id: CAT.LIFESTYLE,     name: 'Lifestyle',     sort: 10 },
    { id: CAT.GENERAL,       name: 'General',       sort: 11 },
  ];

  for (const ac of activeCategories) {
    await db.query(`
      UPDATE categories 
      SET status = 'active', sort_order = $1
      WHERE id = $2
    `, [ac.sort, ac.id]);
  }

  // Fetch all channels
  const channelsRes = await db.query(`
    SELECT c.id, c.name, c.language, cat.name as cur_cat_name
    FROM channels c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.status = 'active'
    ORDER BY c.id ASC
  `);

  console.log(`Processing ${channelsRes.rows.length} channels...`);

  let updatedCount = 0;
  const countsByCat = {};

  for (const ch of channelsRes.rows) {
    const target = classifyChannel(ch.name, ch.cur_cat_name, '', ch.language);
    countsByCat[target.name] = (countsByCat[target.name] || 0) + 1;

    await db.query(`
      UPDATE channels
      SET category_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [target.id, ch.id]);

    updatedCount++;
  }

  console.log(`\nSuccessfully updated ${updatedCount} channels.`);
  console.log('\n=== Final Channel Counts per Category ===');
  console.table(countsByCat);

  // Clear query cache
  try {
    const cache = require('../src/utils/cache');
    cache.flush();
    console.log('[Cache] Cache flushed successfully.');
  } catch (e) {}

  await db.pool.end();
}

if (require.main === module) {
  fixCategories().catch(err => {
    console.error('Error fixing categories:', err);
    process.exit(1);
  });
}

module.exports = { fixCategories, classifyChannel };

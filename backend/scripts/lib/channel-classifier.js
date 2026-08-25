'use strict';
/**
 * channel-classifier.js
 * ─────────────────────────────────────────────────────────────────────────
 * Pure, dependency-free classifier that maps a channel's available metadata
 * to a GLOBAL CONTENT CATEGORY and an OFFICIAL LANGUAGE.
 *
 *   category = channel content type  (Entertainment, News, Movies, …)
 *   language = official channel language (Hindi, Tamil, …, Unknown)
 *
 * Design rules (per task spec):
 *   - NEVER default an Indian channel to Hindi. If language is unclear → 'Unknown'.
 *   - Category names are global content types only — no "Hindi Entertainment".
 *   - Detection uses name / display_name / canonical_name / tvg_id / current
 *     category, in that order of trust. Examples in the dictionaries are only
 *     anchors; the keyword rules generalise to every channel.
 *   - Returns a confidence level so low-confidence rows can be flagged.
 *
 * classify(channel) -> {
 *   category,            // one of GLOBAL_CATEGORIES
 *   language,            // one of LANGUAGES (incl. 'Unknown')
 *   categoryConfidence,  // 'high' | 'medium' | 'low'
 *   languageConfidence,  // 'high' | 'medium' | 'low'
 *   reasons: []          // human-readable why, for the review report
 * }
 */

const GLOBAL_CATEGORIES = [
  'Doordarshan', 'Entertainment', 'Movies', 'News', 'Sports', 'Music', 'Documentary',
  'Devotional', 'Kids', 'Education', 'Business', 'Regional', 'Lifestyle', 'General',
];

const LANGUAGES = [
  'Hindi', 'English', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam',
  'Marathi', 'Punjabi', 'Gujarati', 'Odia', 'Assamese', 'Urdu', 'Bhojpuri',
  'Nepali', 'Sanskrit', 'Unknown',
];

// ── helpers ────────────────────────────────────────────────────────────────
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    // strip quality / resolution tags so they never leak into matching
    .replace(/\((?:\d{3,4}[ip]?|4k|uhd|fhd|hd|sd)\)/g, ' ')
    .replace(/\b(\d{3,4}[ip]?|4k|uhd|fhd|hd|sd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// word-boundary-ish contains on the normalized (space-delimited) string
function has(hay, needle) {
  return (' ' + hay + ' ').includes(' ' + needle + ' ');
}
function hasSub(hay, needle) {
  return hay.includes(needle);
}
function anyWord(hay, words) {
  return words.some((w) => has(hay, w));
}
function anySub(hay, subs) {
  return subs.some((w) => hay.includes(w));
}

// ── LANGUAGE DICTIONARIES ───────────────────────────────────────────────────
// Explicit language tokens that can appear in a channel name.
const LANG_TOKENS = {
  Tamil:     ['tamil', 'tamizh'],
  Telugu:    ['telugu', 'telegu'],
  Bengali:   ['bengali', 'bangla', 'bengal'],
  Malayalam: ['malayalam', 'malayam'],
  Kannada:   ['kannada'],
  Marathi:   ['marathi'],
  Punjabi:   ['punjabi', 'punjab', 'punjabgi'],
  Gujarati:  ['gujarati', 'gujrati', 'gujarat'],
  Odia:      ['odia', 'oriya', 'odisha', 'odissa'],
  Assamese:  ['assamese', 'assam', 'asom'],
  Urdu:      ['urdu'],
  Bhojpuri:  ['bhojpuri'],
  Nepali:    ['nepali', 'nepal'],
  Sanskrit:  ['sanskrit'],
  Hindi:     ['hindi', 'hindustani'],
  English:   ['english'],
};

// Known channel/brand → language. Substring match on the normalized name.
// These anchor common families; keyword rules below generalise the long tail.
const BRAND_LANG = {
  Tamil: [
    'sun tv', 'sun news', 'sun music', 'ktv', 'sun life', 'adithya', 'chutti tv',
    'kalaignar', 'jaya tv', 'jaya plus', 'jaya max', 'vijay tv', 'vijay super',
    'vijay music', 'star vijay', 'polimer', 'thanthi', 'makkal', 'vendhar',
    'vaanavil', 'peppers', 'puthiya thalaimurai', 'puthu yugam', 'sirippoli',
    'raj tv', 'raj digital', 'raj musix', 'vasanth', 'mega tv', 'murasu',
    'malaimurasu', 'news7 tamil', 'captain tv', 'moon tv', 'thai tv', 'suriyan',
    'suthanthira', 'nksin', 'madhimugam', 'malar', 'dheeran', 'velicham',
    'thalaa', 'sankara tv', 'dharshan tv', 'aaseervatham', 'chithiram', 'win tv',
    'mk six', 'thamizhan', 'lotus news', 'nithra',
  ],
  Telugu: [
    'star maa', 'maa tv', 'maa movies', 'maa gold', 'maa music', 'etv andhra',
    'etv telangana', 'etv telugu', 'etv plus', 'etv abhiruchi', 'etv cinema',
    'etv life', 'gemini tv', 'gemini movies', 'gemini music', 'gemini comedy',
    'zee telugu', 'ntv telugu', 'tv5 telugu', 'tv9 telugu', 'ntv', 'sakshi tv',
    'abn andhra', 'abn tv', '10 tv', '99tv', '99 tv', 'hmtv', 'v6 news',
    'raj news telugu', 'mahaa news', 'svbc', 'bhakti tv', 't news', 't v',
    'prime9', 'studio n', 'big tv', 'zee cinemalu', 'vanitha tv', 'i news',
    'tv1 telugu', 'cvr', 'express tv', 'subhavaartha', 'nireekshana', 'aradana',
    'divyavani', 'south station', 'mango', 'indywood', 'etv comedy', 'etv josh',
    'etv music', 'etv abhiruchi', 'etv cinema', 'etv plus', 'big tv', '6 tv telugu',
    'bhakthi tv', 'ishwar bhakti', 'santvani', 'hebron', 'mntv', 'rongeen',
  ],
  Bengali: [
    'zee bangla', 'star jalsha', 'jalsha', 'colors bangla', 'sony aath',
    'aath', 'abp ananda', 'kolkata tv', 'tolly', 'tara news', 'tara muzik',
    'r plus', 'news time bangla', 'calcutta news', 'akaash', 'aakash aath',
    'sangeet bangla', 'dhoom music bangla', 'enterr10 bangla', 'rupashi bangla',
    'ananda barta', 'khobor', 'news18 bangla', 'zee 24 ghanta', '24 ghanta',
    'republic bangla', 'dd bangla', 'ctvn', 'mahuaa', 'ruposhi',
  ],
  Malayalam: [
    'asianet', 'asianet plus', 'asianet movies', 'asianet news', 'surya tv',
    'surya movies', 'surya music', 'surya comedy', 'mazhavil manorama',
    'manorama news', 'kairali', 'kairali we', 'kairali news', 'people tv',
    'amrita tv', 'kappa tv', 'kaumudy', 'jeevan tv', 'safari tv', 'shalom tv',
    'flowers tv', 'mathrubhumi', 'media one', 'reporter tv', 'twenty four',
    '24 news', 'jaihind tv', 'darshana', 'shekinah', 'goodness tv', 'harvest tv',
    'powervision', 'janam tv', 'victers', 'swantham', 'subin', 'salaam tv',
  ],
  Kannada: [
    'udaya', 'udaya movies', 'udaya music', 'udaya comedy', 'colors kannada',
    'colors super', 'zee kannada', 'star suvarna', 'suvarna', 'public tv',
    'tv9 kannada', 'tv5 kannada', 'news18 kannada', 'raj news kannada',
    'power tv', 'btv', 'praja tv', 'digvijay', 'samaya', 'kasturi', 'chandana',
    'news first', 'janasri', ' btv news', 'republic kannada', 'sudarshana',
  ],
  Marathi: [
    'zee marathi', 'zee talkies', 'zee yuva', 'colors marathi', 'star pravah',
    'sony marathi', 'abp majha', 'saam tv', 'saam', 'tv9 marathi', 'ibn lokmat',
    'news18 lokmat', 'zee 24 taas', 'mi marathi', 'jai maharashtra', 'mumbai',
    'fakt marathi', 'maiboli', '9x jhakaas', 'tarang marathi', 'prime marathi',
    'kanak news marathi',
  ],
  Punjabi: [
    'ptc', 'ptc punjabi', 'ptc news', 'ptc chakde', 'ptc simran', 'ptc gold',
    'chardikla', 'chardikla time', 'balle balle', 'zee punjabi', 'zee punjab',
    'pitaara', 'mh one', 'mh1', '9x tashan', 'gurbani', 'gurbaani', 'sikh',
    'apna punjab', 'gaunda punjab', 'jus punjabi', 'kanshi', 'gursikh',
    'chann pardesi', 'dabaa satrangi', 'akaal', 'shan e punjab',
  ],
  Gujarati: [
    'gstv', 'abp asmita', 'zee 24 kalak', 'sandesh news', 'vtv gujarati',
    'tv9 gujarati', 'news18 gujarat', 'colors gujarati', 'gujarat samachar',
    'divya bhaskar', 'abtak', 'gujarat news',
  ],
  Odia: [
    'tarang', 'tarang tv', 'tarang music', 'kalinga tv', 'kanak news',
    'kanak tv', 'nandighosha', 'otv', 'news7 odia', 'zee odisha', 'colors odia',
    'sidharth tv', 'sidharth', 'prarthana tv', 'manjari', 'alankar tv',
  ],
  Assamese: [
    'rengoni', 'ramdhenu', 'pratidin time', 'pravasi', 'prag news', 'prag',
    'news live', 'dy365', 'north east', 'northeast', 'nk tv', 'assam talks',
    'jonack', 'rang', 'protidin',
  ],
  Urdu: [
    'munsif', 'hyder tv', 'salaam', 'zainabia', 'tehzeeb', 'sana tv', 'ary',
    'zee salaam', 'channel win', 'etv urdu', 'din tv', 'aalami samay', 'k news urdu',
  ],
  Bhojpuri: [
    'b4u bhojpuri', 'bhojpuri cinema', 'oscar movies bhojpuri', 'dabang tv',
    'anjan tv', 'sangeet bhojpuri', 'maurya tv', 'bhojpuri', 'dangal',
  ],
  Hindi: [
    'star plus', 'star bharat', 'star utsav', 'starplus', 'colors tv', 'colors rishtey',
    'zee tv', 'zee anmol', 'sony tv', 'sony sab', 'sab tv', 'sony pal', 'sony entertainment',
    'shemaroo tv', 'dangal tv', 'big magic', 'ishara', 'and tv', 'and pictures',
    'aaj tak', 'abp news', 'ndtv india', 'news18 india', 'india tv', 'zee news',
    'republic bharat', 'tv9 bharatvarsh', 'zee hindustan', 'aaj tak hd', 'goldmines',
    'star gold', 'zee cinema', 'sony max', 'sony wah', 'and pictures', '9xm', 'zoom',
    'mastiii', 'b4u music', 'b4u movies', 'zee bollywood', 'dhinchaak', 'enterr10',
    'sanskar', 'aastha', 'satsang', 'sadhna', ' dd ', 'shubh tv', 'samachar plus',
    'bharat express', 'awaaz india', 'swaraj express', 'total tv', 'jan tv',
    'india news', 'khabar', 'zee bharat', 'zee business', 'cnbc awaaz', 'et now swadesh',
  ],
  English: [
    'bbc', 'cnn', 'wion', 'india today', 'times now', 'mirror now', 'republic tv',
    'cnbc tv18', 'ndtv 24x7', 'ndtv profit', 'et now', 'bloomberg', 'al jazeera',
    'france 24', 'dw ', 'russia today', 'rt news', 'firstpost', 'euronews',
    'star movies', 'star world', 'hbo', 'sony pix', 'mnx', 'movies now', 'romedy now',
    'zee cafe', 'comedy central', 'axn', 'amc', 'discovery', 'national geographic',
    'nat geo', 'animal planet', 'history tv', 'travel xp', 'fox life', 'sony bbc earth',
    'cartoon network', 'pogo', 'nick', 'disney channel', 'colors infinity', 'mtv beats',
    'vh1', 'wwe', 'star sports', 'sony ten', 'sony six', 'eurosport', 'dd india',
    'tv brics english', 'cvr english', 'qello', 'stingray', 'the pet collective',
  ],
};

// ── CONTENT-CATEGORY KEYWORD RULES ──────────────────────────────────────────
// Ordered by specificity. First strong match wins for category.
// Literal "news"-type words — appear in the name of an actual news channel.
const NEWS_LITERAL = ['news', 'samachar', 'khabar', 'khobor', 'seithigal', 'varthakal',
  'vaartha', 'varthai'];
// Precise, unambiguous news brands that DON'T contain the word "news".
// (Broad family tokens like 'bbc' / 'ndtv' are intentionally excluded — they also
//  cover non-news feeds such as BBC Earth or NDTV Good Times.)
const NEWS_WORDS = ['news18', 'aaj tak', 'aajtak', 'ndtv 24x7', 'ndtv india',
  'ndtv profit', 'ndtv marathi', 'abp', 'times now', 'timesnow',
  'mirror now', 'tv9', 'india tv', 'india today', 'wion', 'cnn', 'al jazeera',
  'republic tv', 'republic bharat', 'republic bangla', 'republic kannada', 'republic world',
  'reporter tv', 'lokmat', 'majha', 'ananda', '24 ghanta', 'sakshi', 'v6 news', 'hmtv',
  'mahaa', 'public tv', 'janasri', 'kolkata tv', 'raftaar', 'bharatvarsh', 'zee hindustan',
  'pratidin', 'prag news', 'news live', 'dy365', 'polimer', 'thanthi', 'puthiya thalaimurai',
  'kalinga', 'kanak news', 'seithigal', 'daily live', 'euronews', 'france 24',
  'russia today', 'rt news', 'fox news', 'sky news', 'dw english', 'trt world', 'sabc news',
  'abn tv', 'abn andhra', 'ntv telugu', 'sakshi', 'tv5 news', 'prime9', 'bharat express',
  'good news today', 'goodnews today', 'argus news', 'living india', 'sadhna plus news',
  'cnews', 'gulistan news', 'awaaz india', 'swaraj express'];
const BUSINESS_WORDS = ['business', 'cnbc', 'money', 'et now', 'bloomberg', 'profit',
  'mandi', 'market', 'share', 'stock', 'awaaz', 'swadesh', 'moneycontrol'];
const MOVIE_WORDS = ['movie', 'movies', 'cinema', 'cinemalu', 'gold', 'max', 'picture',
  'pictures', 'film', 'talkies', 'bollywood', 'goldmines', 'anmol', 'utsav', 'pix',
  'mnx', 'wow', 'oscar movies', 'romedy', 'thrills', 'action', 'classic', 'kmax'];
const MUSIC_WORDS = ['music', '9xm', 'mtv', 'mastiii', 'zoom', 'mtunes', 'stingray',
  'qello', 'sangeet', 'beats', 'raga', 'muzik', 'musix', 'dhoom', 'b4u music',
  'vh1', '9x tashan', '9x jhakaas', 'tashan', 'dhinchaak', 'classic rock', 'djazz',
  'kpop', 'concerts', 'song', 'gaane'];
const KIDS_WORDS = ['kids', 'cartoon', 'pogo', 'hungama', 'chutti', 'nick', 'disney',
  'animax', 'mr bean', 'chota', 'junior', 'toon', 'baby', 'discovery kids',
  'sonic', 'nazara', 'gubbare', 'kochu tv', 'kushi tv', 'chintu', 'kids tv'];
const DEVOTIONAL_WORDS = ['aastha', 'sanskar', 'bhakti', 'bhakthi', 'devotional', 'satsang',
  'sadhna tv', 'jesus', 'christ', 'gospel', 'harvest', 'hebron', 'shalom',
  'angel tv', 'divyavani', 'prarthana', 'shubh tv', 'shubhsandesh', 'spiritual',
  'peace tv', 'quran', 'temple', 'svbc', 'bhajan', 'adhyatm', 'sanatan', 'gurbani',
  'gurbaani', 'aradana', 'shekinah', 'nireekshana', 'subhavaartha', 'sana tv',
  'zainabia', 'mercy tv', 'kcm', 'mta', 'hindu dharmam', 'jinvani', 'santvani',
  'salvation', 'madha tv', 'sri sankara', 'sri venkateswara', 'ishwar bhakti',
  'total bhakti', 'vedic', 'sankara tv', 'aaseervatham', 'dharshan tv', 'gursikh',
  'chardikla gurbaani'];
const SPORTS_WORDS = ['sport', 'sports', 'cricket', 'football', 'ten', 'eurosport',
  'wwe', 'sony six', 'star sports', 'dd sports', 'khel', 'kabaddi', 'sports18'];
const EDUCATION_WORDS = ['education', 'gyan', 'gyandarshan', 'vidya', 'study', 'swayam',
  'class', 'exam', 'learning', 'vyas', 'digital learning', 'eklavya', 'shiksha'];
const LIFESTYLE_WORDS = ['food', 'travel', 'living', 'lifestyle', 'fashion', 'tlc',
  'fyi', 'discovery', 'nat geo', 'national geographic', 'animal planet', 'history',
  'epic', 'infotainment', 'health', 'fitness', 'home', 'good times', 'travelxp',
  'travel xp', 'fox life', 'sony bbc earth', 'inwild', 'inwonder', 'infast',
  'wild', 'nature', 'cook', 'pet collective', 'ndtv good times'];
const ENTERTAINMENT_WORDS = ['entertainment', 'plus', 'bharat', 'colors', 'zee tv',
  'sony', 'sab', 'maa', 'jalsha', 'vijay', 'sun tv', 'gemini', 'udaya', 'asianet',
  'suvarna', 'pravah', 'yuva', 'utsav', 'anmol', 'star', 'general', 'serial',
  'comedy', 'aath', 'pravaah', 'shemaroo', 'dangal', 'big magic', 'enterr10',
  'ishara', 'rishtey', 'tolly', 'pitaara', 'kairali', 'flowers', 'surya', 'mazhavil'];

const DOORDARSHAN_WORDS = ['doordarshan', 'dd national', 'dd news', 'dd india',
  'dd bharati', 'dd sports', 'dd kisan', 'dd bangla', 'dd malayalam', 'dd podhigai',
  'dd saptagiri', 'dd chandana', 'dd yadagiri', 'dd girnar', 'dd urdu', 'dd kashir',
  'dd north east', 'dd retro', 'ddk', 'lok sabha', 'rajya sabha', 'sansad'];

// ── main classifier ─────────────────────────────────────────────────────────
function detectLanguage(hay, currentCat, currentLang) {
  // 1. explicit language token in the name (very strong)
  for (const [lang, toks] of Object.entries(LANG_TOKENS)) {
    if (anySub(hay, toks)) return { language: lang, confidence: 'high', reason: `name contains "${toks.find(t => hay.includes(t))}"` };
  }
  // 2. known brand family (strong)
  for (const [lang, brands] of Object.entries(BRAND_LANG)) {
    const hit = brands.find((b) => hay.includes(b));
    if (hit) return { language: lang, confidence: 'high', reason: `brand "${hit}" → ${lang}` };
  }
  // 3. old language-as-category buckets give a decent hint (medium)
  const catLangMap = {
    'tamil': 'Tamil', 'telugu': 'Telugu', 'bengali': 'Bengali', 'malayalam': 'Malayalam',
    'kannada': 'Kannada', 'marathi': 'Marathi', 'punjabi': 'Punjabi', 'gujarati': 'Gujarati',
    'odia': 'Odia', 'assamese': 'Assamese', 'urdu': 'Urdu', 'bhojpuri': 'Bhojpuri',
  };
  const cl = (currentCat || '').toLowerCase();
  for (const [k, v] of Object.entries(catLangMap)) {
    if (cl.includes(k)) return { language: v, confidence: 'medium', reason: `old category "${currentCat}"` };
  }
  if (cl.includes('english')) return { language: 'English', confidence: 'medium', reason: `old category "${currentCat}"` };
  // 4. trust an existing NON-Hindi language already on the row (medium)
  //    (Hindi is NOT trusted — it was the blanket default we are undoing)
  if (currentLang) {
    const nl = normalizeExistingLang(currentLang);
    if (nl && nl !== 'Hindi' && nl !== 'Unknown') {
      return { language: nl, confidence: 'medium', reason: `existing language "${currentLang}"` };
    }
  }
  // 5. give up → Unknown (never default to Hindi)
  return { language: 'Unknown', confidence: 'low', reason: 'no language signal' };
}

function normalizeExistingLang(raw) {
  const l = (raw || '').trim().toLowerCase();
  const map = {
    hindi: 'Hindi', english: 'English', bengali: 'Bengali', bangla: 'Bengali',
    tamil: 'Tamil', telugu: 'Telugu', kannada: 'Kannada', malayalam: 'Malayalam',
    marathi: 'Marathi', punjabi: 'Punjabi', gujarati: 'Gujarati', odia: 'Odia',
    oriya: 'Odia', assamese: 'Assamese', urdu: 'Urdu', bhojpuri: 'Bhojpuri',
    nepali: 'Nepali', sanskrit: 'Sanskrit',
  };
  return map[l] || null;
}

function detectCategory(hay, currentCat) {
  const cl = (currentCat || '').toLowerCase();

  // Doordarshan — brand prefix or explicit
  if (/^dd /.test(hay) || hay.startsWith('doordarshan') || anySub(hay, DOORDARSHAN_WORDS) || cl === 'doordarshan') {
    return { category: 'Doordarshan', confidence: 'high', reason: 'Doordarshan/DD channel' };
  }
  // Devotional (before News/Entertainment — many carry generic words)
  if (anySub(hay, DEVOTIONAL_WORDS)) return { category: 'Devotional', confidence: 'high', reason: 'devotional keyword' };
  // Kids
  if (anySub(hay, KIDS_WORDS)) return { category: 'Kids', confidence: 'high', reason: 'kids keyword' };
  // Sports
  if (anyWord(hay, SPORTS_WORDS) || anySub(hay, ['star sports', 'sony ten', 'dd sports', 'sports18'])) {
    return { category: 'Sports', confidence: 'high', reason: 'sports keyword' };
  }
  // Business (before News since CNBC etc.)
  if (anySub(hay, ['cnbc', 'et now', 'bloomberg', 'moneycontrol', 'zee business', 'swadesh']) ||
      anyWord(hay, ['business', 'money', 'market', 'mandi', 'profit'])) {
    return { category: 'Business', confidence: 'high', reason: 'business keyword' };
  }
  // News — literal "news"-type word OR a precise news brand
  if (anyWord(hay, NEWS_LITERAL) || anySub(hay, NEWS_WORDS)) {
    return { category: 'News', confidence: 'high', reason: 'news keyword' };
  }
  // Music
  if (anySub(hay, MUSIC_WORDS)) return { category: 'Music', confidence: 'high', reason: 'music keyword' };
  // Movies
  if (anySub(hay, MOVIE_WORDS)) return { category: 'Movies', confidence: 'high', reason: 'movie keyword' };
  // Education
  if (anySub(hay, EDUCATION_WORDS)) return { category: 'Education', confidence: 'medium', reason: 'education keyword' };
  // Lifestyle / infotainment
  if (anySub(hay, LIFESTYLE_WORDS)) return { category: 'Lifestyle', confidence: 'medium', reason: 'lifestyle keyword' };
  // Entertainment (broad GEC brands)
  if (anySub(hay, ENTERTAINMENT_WORDS)) return { category: 'Entertainment', confidence: 'medium', reason: 'entertainment brand/keyword' };

  // Fall back on the old category if it was already a clean content type
  const cleanOld = {
    'music': 'Music', 'kids': 'Kids', 'sports': 'Sports', 'devotional': 'Devotional',
    'doordarshan': 'Doordarshan', 'lifestyle / infotainment': 'Lifestyle',
    'hindi movies': 'Movies', 'english movies': 'Movies', 'hindi news': 'News',
    'english news': 'News', 'business news': 'Business',
    // NOTE: 'international news' is deliberately NOT mapped — that bucket is mostly
    // foreign entertainment (AMC, Bravo, PBS, SYFY…), not news. Let keywords decide.
    'hindi entertainment': 'Entertainment', 'documentary': 'Documentary', 'religious': 'Devotional', 'international': 'General',
  };
  if (cl in cleanOld && cleanOld[cl]) {
    return { category: cleanOld[cl], confidence: 'medium', reason: `old category "${currentCat}"` };
  }

  // Language-as-category with no content hint → Regional (unclear content)
  const regionalCats = ['tamil', 'telugu', 'bengali', 'malayalam', 'kannada', 'marathi',
    'punjabi', 'gujarati', 'odia', 'assamese / north east', 'assamese', 'urdu', 'bhojpuri'];
  if (regionalCats.includes(cl)) {
    return { category: 'Regional', confidence: 'low', reason: `language-only category "${currentCat}", content unclear` };
  }

  return { category: 'General', confidence: 'low', reason: 'no content signal' };
}

function classify(ch) {
  const parts = [ch.name, ch.display_name, ch.canonical_name, ch.tvg_id]
    .filter(Boolean)
    .map(norm)
    .join(' ');
  const hay = ' ' + parts + ' ';

  const lang = detectLanguage(parts, ch.category_name, ch.language);
  const cat = detectCategory(parts, ch.category_name);

  let category = cat.category;
  let categoryConfidence = cat.confidence;
  let catReason = cat.reason;

  // Content unclear (General) but we DO know a regional Indian language →
  // classify as 'Regional' per the "Regional only when content is unclear" rule.
  // General is reserved for channels with neither a content nor a regional signal.
  const REGIONAL_LANGS = ['Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam',
    'Marathi', 'Punjabi', 'Gujarati', 'Odia', 'Assamese', 'Urdu', 'Bhojpuri', 'Nepali'];
  if (category === 'General' && REGIONAL_LANGS.includes(lang.language)) {
    category = 'Regional';
    categoryConfidence = 'low';
    catReason = `content unclear, regional language ${lang.language} → Regional`;
  }

  return {
    category,
    language: lang.language,
    categoryConfidence,
    languageConfidence: lang.confidence,
    reasons: [`cat: ${catReason}`, `lang: ${lang.reason}`],
  };
}

module.exports = { classify, GLOBAL_CATEGORIES, LANGUAGES, norm };

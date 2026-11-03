'use strict';
/**
 * channelNumbering.js
 * Single source of truth for the app's PERMANENT channel numbers.
 *
 * Numbers are bucketed into 9 genre "super-blocks" so that a channel's number
 * tells you its genre at a glance and never changes when new channels are added:
 *
 *   001–099 News · 100–199 Entertainment · 200–299 Movies · 300–399 Sports ·
 *   400–499 Music · 500–599 Kids · 600–699 Regional · 700–799 Devotional ·
 *   800–899 International · 900+ Other
 *
 * Permanence rule: `assignChannelNumbers()` only ever fills rows where
 * channel_number IS NULL. Existing numbers are never renumbered. New channels
 * take MAX(number in their block)+1, so numbers are stable and unique forever.
 *
 * The genre for a channel is derived from its category/name/language/country by
 * `resolveGenre()`, reusing the proven LIKE-pattern logic from
 * scripts/import-indian-streams.js (mapToIndianCategory). Keeping that logic
 * HERE (JS) rather than in SQL means there is exactly one place to change it.
 */

// ─── Genre super-blocks (ordered) ───────────────────────────────────────────
// base = first number of the block. Block spans base .. base+99 (99 slots).
const GENRE_BLOCKS = [
  { genre: 'News',          base: 0   },
  { genre: 'Entertainment', base: 100 },
  { genre: 'Movies',        base: 200 },
  { genre: 'Sports',        base: 300 },
  { genre: 'Music',         base: 400 },
  { genre: 'Kids',          base: 500 },
  { genre: 'Regional',      base: 600 },
  { genre: 'Devotional',    base: 700 },
  { genre: 'International',  base: 800 },
  { genre: 'Other',         base: 900 },
];

const BLOCK_SIZE = 100;      // numbers per block (base .. base+99)
const SPILL_BASE = 9000;     // overflow pool if a block ever exceeds 99 channels

const GENRES = GENRE_BLOCKS.map(b => b.genre);
const BASE_OF = GENRE_BLOCKS.reduce((m, b) => { m[b.genre] = b.base; return m; }, {});

/**
 * resolveGenre(categoryName, channelName, language, country) → one of GENRES.
 * Maps the ~28 import categories + free-text signals onto the 9 super-blocks.
 * Mirrors scripts/import-indian-streams.js:mapToIndianCategory so grouping is
 * consistent with how channels were categorized on import.
 */
function resolveGenre(categoryName, channelName, language, country) {
  const cat = (categoryName || '').toLowerCase();
  const n   = (channelName  || '').toLowerCase();
  const l   = (language     || '').toLowerCase();
  const ctry = (country     || '').toLowerCase();

  // Text we scan for keyword hits — category name is the strongest signal,
  // channel name is the fallback.
  const hay = `${cat} ${n}`;

  // ── News (Hindi/English/Business/International News, Doordarshan) ──────────
  // Doordarshan/Sansad are news/public-broadcast channels.
  if (/\bdd\b|doordarshan|sansad|lok\s*sabha|rajya\s*sabha|parliament/.test(hay)) return 'News';
  if (/\bnews\b/.test(hay) || /\bcnbc|bbc|cnn|al\s*jazeera\b/.test(n)) return 'News';

  // ── Movies (Hindi/English Movies) ─────────────────────────────────────────
  if (/\bmovie|cinema|\bfilm\b|films\b/.test(hay)) return 'Movies';

  // ── Sports ────────────────────────────────────────────────────────────────
  if (/\bsport|cricket|football|\bipl\b|tennis|kabaddi\b/.test(hay)) return 'Sports';

  // ── Music ─────────────────────────────────────────────────────────────────
  if (/\bmusic|songs?\b/.test(hay) || /\bfm\b/.test(n)) return 'Music';

  // ── Kids ──────────────────────────────────────────────────────────────────
  if (/\bkids|children|cartoon|toon\b/.test(hay)) return 'Kids';

  // ── Devotional ────────────────────────────────────────────────────────────
  if (/\breligio|devotion|spiritual|bhakti|temple|church|islamic|vedic|aastha|sanskar\b/.test(hay)) return 'Devotional';

  // ── Regional (Indian regional languages) ──────────────────────────────────
  const regionalLangs = new Set([
    'tamil','telugu','malayalam','kannada','bengali','marathi','punjabi',
    'gujarati','odia','assamese','urdu','bhojpuri',
  ]);
  if (regionalLangs.has(l)) return 'Regional';
  if (/\btamil|telugu|malayalam|kannada|bengali|bangla|marathi|punjabi|gujarati|odia|oriya|assam(ese)?|north\s*east|urdu|bhojpuri\b/.test(cat)) return 'Regional';

  // ── International (non-Indian country, or explicitly international) ────────
  if (/\binternational|world\b/.test(hay)) return 'International';
  if (ctry && ctry !== 'in' && ctry !== 'india') return 'International';

  // ── Entertainment (Hindi Entertainment, General) ──────────────────────────
  if (/\bentertain|general|\bgec\b/.test(hay)) return 'Entertainment';

  // ── Everything else (Education, Lifestyle/Infotainment, Free FAST, …) ─────
  return 'Other';
}

/**
 * assignChannelNumbers(db)
 * Idempotently assigns sequential channel_number (1, 2, 3, 4...) + genre to
 * every channel that doesn't have one yet. Existing numbers are preserved.
 *
 * @param {{query: Function}} db  pg pool wrapper (backend/src/config/db.js)
 * @returns {Promise<{assigned:number, perGenre:Object, spilled:number}>}
 */
async function assignChannelNumbers(db) {
  // 1) Find the highest channel_number currently used
  const maxRes = await db.query(
    'SELECT COALESCE(MAX(channel_number), 0) AS max_num FROM channels'
  );
  let nextNum = parseInt(maxRes.rows[0].max_num, 10) + 1;

  // 2) Fetch channels missing channel_number or genre
  const pending = await db.query(`
    SELECT c.id, c.name, c.language, c.country, cat.name AS category_name, c.channel_number
    FROM channels c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.channel_number IS NULL OR c.genre IS NULL
    ORDER BY c.name ASC
  `);

  const perGenre = {};
  let assigned = 0;

  for (const ch of pending.rows) {
    const genre = resolveGenre(ch.category_name, ch.name, ch.language, ch.country);
    let number = ch.channel_number;
    if (number === null || number === undefined) {
      number = nextNum++;
      assigned++;
    }

    await db.query(
      'UPDATE channels SET channel_number = $1, genre = $2 WHERE id = $3',
      [number, genre, ch.id]
    );
    perGenre[genre] = (perGenre[genre] || 0) + 1;
  }

  return { assigned, perGenre, spilled: 0 };
}

module.exports = {
  GENRE_BLOCKS,
  GENRES,
  BLOCK_SIZE,
  SPILL_BASE,
  resolveGenre,
  assignChannelNumbers,
};

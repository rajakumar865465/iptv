const db = require('../config/db');
const { success, error } = require('../utils/response');
const { getEffectiveChannelTier } = require('../services/subscriptionService');

// PLAYABLE health statuses — must match channelController.js
const WORKING_STATUSES = ['online', 'playable', 'stable', 'unstable'];
const ALLOW_UNKNOWN = process.env.ALLOW_UNKNOWN_STREAMS === 'true';

const formatChannelRow = (req, row) => {
  if (!row) return row;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  const localUrl = row.local_logo_url ? `${baseUrl}${row.local_logo_url}` : null;
  const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');
  const formatted = {
    ...row,
    channel_tier: getEffectiveChannelTier(row),
    logo_url: localUrl || row.logo_url,
    local_logo_url: localUrl,
    logo_status: row.logo_status || 'unknown',
  };
  if (!isAdmin) {
    formatted.stream_url = formatted.stream_url ? '/api/channels/' + row.id + '/play' : null;
    delete formatted.backup_stream_url;
  }
  return formatted;
};

const canonicalChannelName = (name) => {
  return (name || '')
    .toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, ' ')
    .replace(/\b(apac|asia|in|india|backup|live|feed)\b/gi, ' ')
    .replace(/\s*(hd|sd|fhd|uhd|4k)\s*/gi, ' ')
    .replace(/\s*(1080p?|720p?|576p?|480p?|360p?)\s*/gi, ' ')
    .replace(/\s*(backup|live|channel|source\s*\d*)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const qualityRank = (q) => {
  const s = (q || '').toLowerCase();
  if (s.includes('4k') || s.includes('2160')) return 5;
  if (s.includes('fhd') || s.includes('1080')) return 4;
  if (s.includes('hd') || s.includes('720')) return 3;
  if (s.includes('sd') || s.includes('576') || s.includes('480')) return 2;
  if (s.includes('360')) return 1;
  return 0;
};

const channelScore = (row) => {
  let score = qualityRank(row.quality) * 100;
  const lang = (row.language || '').toLowerCase();
  if (lang === 'hindi') score += 50;
  else if (lang === 'english') score += 40;
  else if (['bengali', 'tamil', 'telugu'].includes(lang)) score += 30;
  if (row.stream_url) score += 20;
  if (row.popularity_score > 0) score += Math.min(row.popularity_score, 50);
  return score;
};

const deduplicateChannelRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  const seen = new Map();
  for (const row of rows) {
    const key = canonicalChannelName(row.name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
    } else {
      if (channelScore(row) > channelScore(existing)) {
        seen.set(key, row);
      }
    }
  }
  return Array.from(seen.values());
};

// Fix #26: Cache schema introspection results at module level to avoid per-request queries
let mergedIntoColumnExists = null;
let healthStatusColumnExists = null;

async function checkMergedIntoColumn() {
  if (mergedIntoColumnExists !== null) return mergedIntoColumnExists;
  try {
    const result = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='merged_into_channel_id'`
    );
    mergedIntoColumnExists = result.rows.length > 0;
  } catch (_) {
    mergedIntoColumnExists = false;
  }
  return mergedIntoColumnExists;
}

async function checkHealthStatusColumn() {
  if (healthStatusColumnExists !== null) return healthStatusColumnExists;
  try {
    const result = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='health_status'`
    );
    healthStatusColumnExists = result.rows.length > 0;
  } catch (_) {
    healthStatusColumnExists = false;
  }
  return healthStatusColumnExists;
}

/**
 * Build a health filter and param list for playable channels.
 * Returns { fragment, params, nextIndex }
 */
function buildHealthFilter(paramIndex) {
  const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
  let fragment = `c.health_status IN (${statusList})`;
  return { fragment, params: [...WORKING_STATUSES], nextIndex: paramIndex + WORKING_STATUSES.length };
}

/**
 * Base WHERE conditions for home/playable channels.
 * Returns { conditions, params, paramIndex }
 */
async function buildBaseConditions() {
  const conditions = [
    `c.status = 'active'`,
    `c.is_hidden IS NOT TRUE`,
    `c.is_removed IS NOT TRUE`,
    `c.stream_url IS NOT NULL`,
    `c.stream_url != ''`,
    `c.is_visible_app IS NOT FALSE`,
  ];
  const params = [];
  let paramIndex = 1;

  // merged_into guard (migration 012) - cached check
  if (await checkMergedIntoColumn()) {
    conditions.unshift(`c.merged_into_channel_id IS NULL`);
  }

  // health filter - cached check
  if (await checkHealthStatusColumn()) {
    const { fragment, params: hp, nextIndex } = buildHealthFilter(paramIndex);
    conditions.push(`(${fragment})`);
    params.push(...hp);
    paramIndex = nextIndex;
  }

  return { conditions, params, paramIndex };
}

/**
 * Fetch N channels for a section, applying extra conditions/ordering.
 */
async function fetchSection(req, extraConditions, extraParams, orderSQL, limit, baseConditions, baseParams, baseParamIndex) {
  const allConditions = [...baseConditions, ...extraConditions];
  const allParams = [...baseParams, ...extraParams];

  const sql = `
    SELECT c.*, cat.name AS category_name
    FROM channels c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE ${allConditions.join(' AND ')}
    ${orderSQL}
    LIMIT $${allParams.length + 1}
  `;

  const result = await db.query(sql, [...allParams, limit]);
  return result.rows.map(row => formatChannelRow(req, row));
}

/**
 * GET /api/home
 * Returns structured DTH-style home sections:
 * - continue_watching (last 5 recently watched by the user, if auth)
 * - premium_channels
 * - popular_channels
 * - featured_channels
 * - categories: ordered list of category sections each with up to 15 channels
 */
exports.getHome = async (req, res) => {
  try {
    const userId = req.user?.id || null;

    const { conditions: bc, params: bp } = await buildBaseConditions();

    const JOIN = `LEFT JOIN categories cat ON c.category_id = cat.id`;
    const BASE_WHERE = `WHERE ${bc.join(' AND ')}`;

    // ── 1. Continue Watching ──────────────────────────────────────────────
    let continueWatching = [];
    if (userId) {
      try {
        const cwRes = await db.query(
          `SELECT DISTINCT ON (wh.channel_id)
             c.*, cat.name AS category_name,
             wh.watched_at
           FROM watch_history wh
           JOIN channels c ON c.id = wh.channel_id
           LEFT JOIN categories cat ON c.category_id = cat.id
           WHERE wh.user_id = $1
             AND c.status = 'active'
             AND c.is_hidden IS NOT TRUE
             AND c.is_removed IS NOT TRUE
             AND c.is_visible_app IS NOT FALSE
             AND c.stream_url IS NOT NULL AND c.stream_url != ''
           ORDER BY wh.channel_id, wh.watched_at DESC
           LIMIT 10`,
          [userId]
        );
        const sorted = cwRes.rows.sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at));
        continueWatching = sorted.slice(0, 5).map(row => formatChannelRow(req, row));
      } catch (e) {
        console.error('[home] continue_watching error:', e.message);
      }
    }

    // ── 2-5. Run all four sections in parallel for faster response ─────────
    const cache = require('../utils/cache');
    const CACHE_KEY = 'home_common_data';
    let commonData = cache.get(CACHE_KEY);

    if (!commonData) {
      const [premiumResult, popularResult, featuredResult, catChannelsRes] = await Promise.all([

        // 2. Premium Channels
        db.query(
          `SELECT c.*, cat.name AS category_name
           FROM channels c ${JOIN}
           ${BASE_WHERE}
             AND (c.is_premium = true OR c.is_paid = true OR LOWER(COALESCE(c.channel_tier, 'free')) IN ('pro', 'plus'))
           ORDER BY
             CASE WHEN c.is_featured = true THEN 0 ELSE 1 END,
             COALESCE(c.popularity_score, 0) DESC,
             COALESCE(c.sort_order, 999) ASC,
             c.name ASC
           LIMIT 20`,
          bp
        ).catch(e => { console.error('[home] premium_channels error:', e.message); return { rows: [] }; }),

        // 3. Popular Channels
        db.query(
          `SELECT c.*, cat.name AS category_name
           FROM channels c ${JOIN}
           ${BASE_WHERE}
           ORDER BY
             CASE WHEN c.is_featured = true THEN 0 ELSE 1 END,
             CASE WHEN c.is_popular = true THEN 0 ELSE 1 END,
             COALESCE(c.popularity_score, 0) DESC,
             COALESCE(c.watch_count, 0) DESC,
             COALESCE(c.sort_order, 999) ASC,
             c.name ASC
           LIMIT 20`,
          bp
        ).catch(e => { console.error('[home] popular_channels error:', e.message); return { rows: [] }; }),

        // 4. Featured Channels
        db.query(
          `SELECT c.*, cat.name AS category_name
           FROM channels c ${JOIN}
           ${BASE_WHERE}
             AND c.is_featured = true
           ORDER BY
             COALESCE(c.popularity_score, 0) DESC,
             COALESCE(c.sort_order, 999) ASC,
             c.name ASC
           LIMIT 15`,
          bp
        ).catch(e => { console.error('[home] featured_channels error:', e.message); return { rows: [] }; }),

        // 5. Category Sections — single CTE query with all required fields for logo formatting
        db.query(
          `WITH ranked_channels AS (
             SELECT
               c.*,
               cat.name AS category_name,
               cat.icon_url,
               cat.sort_order AS cat_sort_order,
               ROW_NUMBER() OVER (
                 PARTITION BY c.category_id
                 ORDER BY
                   CASE WHEN c.is_featured = true THEN 0 ELSE 1 END,
                   COALESCE(c.popularity_score, 0) DESC,
                   COALESCE(c.watch_count, 0) DESC,
                   COALESCE(c.sort_order, 999) ASC,
                   c.name ASC
               ) AS rn
             FROM channels c
             LEFT JOIN categories cat ON c.category_id = cat.id
             ${BASE_WHERE}
               AND cat.status = 'active'
               AND c.category_id IS NOT NULL
           )
           SELECT
             cat.id,
             cat.name,
             cat.icon_url,
             cat.sort_order AS cat_sort_order,
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', rc.id,
                 'name', rc.name,
                 'logo_url', rc.logo_url,
                 'local_logo_url', rc.local_logo_url,
                 'logo_status', rc.logo_status,
                 'stream_url', rc.stream_url,
                 'backup_stream_url', rc.backup_stream_url,
                 'health_status', rc.health_status,
                 'category_id', rc.category_id,
                 'category_name', rc.category_name,
                 'language', rc.language,
                 'quality', rc.quality,
                 'status', rc.status,
                 'channel_tier', rc.channel_tier,
                 'is_paid', rc.is_paid,
                 'is_premium', rc.is_premium,
                 'is_featured', rc.is_featured,
                 'is_popular', rc.is_popular,
                 'popularity_score', rc.popularity_score,
                 'watch_count', rc.watch_count,
                 'sort_order', rc.sort_order,
                 'referrer', rc.referrer,
                 'user_agent', rc.user_agent
               ) ORDER BY rc.rn
             ) AS channels
           FROM categories cat
           LEFT JOIN ranked_channels rc ON cat.id = rc.category_id AND rc.rn <= 15
           WHERE cat.status = 'active'
           GROUP BY cat.id
           HAVING COUNT(rc.id) > 0
           ORDER BY cat.sort_order ASC, cat.name ASC`,
          bp
        ).catch(e => { console.error('[home] categories error:', e.message); return { rows: [] }; }),

      ]);

      commonData = {
        premiumResult,
        popularResult,
        featuredResult,
        catChannelsRes,
      };
      // Cache for 60 seconds to alleviate load spikes while keeping content relatively fresh
      cache.set(CACHE_KEY, commonData, 60);
    }

    const { premiumResult, popularResult, featuredResult, catChannelsRes } = commonData;

    const premiumChannels  = deduplicateChannelRows(premiumResult.rows).map(row => formatChannelRow(req, row));
    const popularChannels  = deduplicateChannelRows(popularResult.rows).map(row => formatChannelRow(req, row));
    const featuredChannels = deduplicateChannelRows(featuredResult.rows).map(row => formatChannelRow(req, row));
    const categories = catChannelsRes.rows.map(row => {
      const deduped = deduplicateChannelRows(row.channels || []).map(ch => formatChannelRow(req, ch));
      return {
        id: row.id,
        name: row.name,
        icon_url: row.icon_url,
        sort_order: row.cat_sort_order,
        channel_count: deduped.length,
        channels: deduped,
      };
    });

    return res.json({
      success: true,
      data: {
        continue_watching: continueWatching,
        premium_channels: premiumChannels,
        popular_channels: popularChannels,
        featured_channels: featuredChannels,
        categories,
      },
    });
  } catch (err) {
    console.error('[home] getHome error:', err);
    return error(res, 'Failed to load home data', 500);
  }
};

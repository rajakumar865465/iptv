const db = require('../config/db');
const { success, error } = require('../utils/response');

// PLAYABLE health statuses — must match channelController.js
const WORKING_STATUSES = ['online', 'playable', 'stable', 'unstable', 'unknown'];
const ALLOW_UNKNOWN = process.env.ALLOW_UNKNOWN_STREAMS === 'true';

const formatChannelRow = (req, row) => {
  if (!row) return row;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  const localUrl = row.local_logo_url ? `${baseUrl}${row.local_logo_url}` : null;
  return {
    ...row,
    logo_url: localUrl || row.logo_url,
    local_logo_url: localUrl,
    logo_status: row.logo_status || 'unknown',
  };
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
 * Build a health fragment and param list for playable channels.
 * Returns { fragment, params, nextIndex }
 */
function buildHealthFilter(paramIndex) {
  const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
  // Always allow NULL (unscanned) and 'unknown'; ALLOW_UNKNOWN kept for backwards compat
  let fragment = `(c.health_status IS NULL OR c.health_status IN (${statusList}))`;
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
  let idx = baseParamIndex;

  // Remap extra param placeholders to correct indices
  const remappedOrder = orderSQL;
  const limitParam = idx + extraParams.length;

  const sql = `
    SELECT c.*, cat.name AS category_name
    FROM channels c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE ${allConditions.join(' AND ')}
    ${remappedOrder}
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

    const RECOMMENDED_ORDER = `
      ORDER BY
        CASE WHEN c.is_premium = true THEN 0 ELSE 1 END,
        CASE WHEN c.is_featured = true THEN 0 ELSE 1 END,
        COALESCE(c.popularity_score, 0) DESC,
        COALESCE(c.watch_count, 0) DESC,
        COALESCE(c.health_score, 0) DESC,
        COALESCE(c.sort_order, 999) ASC,
        c.name ASC
    `;

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
             AND c.stream_url IS NOT NULL AND c.stream_url != ''
           ORDER BY wh.channel_id, wh.watched_at DESC
           LIMIT 10`,
          [userId]
        );
        // Sort by most-recently-watched
        const sorted = cwRes.rows.sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at));
        continueWatching = sorted.slice(0, 5).map(row => formatChannelRow(req, row));
      } catch (e) {
        console.error('[home] continue_watching error:', e.message);
      }
    }

    // ── 2. Premium Channels ───────────────────────────────────────────────
    let premiumChannels = [];
    try {
      const pres = await db.query(
        `SELECT c.*, cat.name AS category_name
         FROM channels c ${JOIN}
         ${BASE_WHERE}
           AND c.is_premium = true
         ORDER BY
           CASE WHEN c.is_featured = true THEN 0 ELSE 1 END,
           COALESCE(c.popularity_score, 0) DESC,
           COALESCE(c.sort_order, 999) ASC,
           c.name ASC
         LIMIT 20`,
        bp
      );
      premiumChannels = pres.rows.map(row => formatChannelRow(req, row));
    } catch (e) {
      console.error('[home] premium_channels error:', e.message);
    }

    // ── 3. Popular Channels ───────────────────────────────────────────────
    let popularChannels = [];
    try {
      const popRes = await db.query(
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
      );
      popularChannels = popRes.rows.map(row => formatChannelRow(req, row));
    } catch (e) {
      console.error('[home] popular_channels error:', e.message);
    }

    // ── 4. Featured Channels ──────────────────────────────────────────────
    let featuredChannels = [];
    try {
      const fRes = await db.query(
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
      );
      featuredChannels = fRes.rows.map(row => formatChannelRow(req, row));
    } catch (e) {
      console.error('[home] featured_channels error:', e.message);
    }

    // ── 5. Category Sections ──────────────────────────────────────────────
    // A-2 FIX: Use single query with JSON_AGG instead of N+1 parallel queries
    let categories = [];
    try {
      const catChannelsRes = await db.query(
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
               'stream_url', rc.stream_url,
               'category_id', rc.category_id,
               'category_name', rc.category_name,
               'language', rc.language,
               'quality', rc.quality,
               'is_premium', rc.is_premium,
               'is_featured', rc.is_featured,
               'popularity_score', rc.popularity_score,
               'watch_count', rc.watch_count
             ) ORDER BY rc.rn
           ) AS channels
         FROM categories cat
         LEFT JOIN ranked_channels rc ON cat.id = rc.category_id AND rc.rn <= 15
         WHERE cat.status = 'active'
         GROUP BY cat.id
         HAVING COUNT(rc.id) > 0
         ORDER BY cat.sort_order ASC, cat.name ASC`,
        bp
      );

      categories = catChannelsRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        icon_url: row.icon_url,
        sort_order: row.cat_sort_order,
        channel_count: row.channels?.length || 0,
        channels: (row.channels || []).map(ch => formatChannelRow(req, ch))
      }));
    } catch (e) {
      console.error('[home] categories error:', e.message);
    }

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

const db = require('../config/db');
const { success, error } = require('../utils/response');
const { generateProxySessionToken } = require('../utils/jwt');
const crypto = require('crypto');

const ALLOW_UNKNOWN = process.env.ALLOW_UNKNOWN_STREAMS === 'true';

let healthStatusColumnExists = null;
// Fix #26: Cache schema introspection results at module level to avoid per-request queries
let channelStreamsTableExists = null;
let channelFailColumnsExist = null;
let mergedIntoColumnExists = null;

async function checkHealthStatusColumn() {
  if (healthStatusColumnExists !== null) return healthStatusColumnExists;
  try {
    const result = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'channels' AND column_name = 'health_status'
    `);
    healthStatusColumnExists = result.rows.length > 0;
  } catch (err) {
    // DB unavailable — don't cache, retry on the next call once it recovers
    return false;
  }
  return healthStatusColumnExists;
}

async function checkMergedIntoColumn() {
  if (mergedIntoColumnExists !== null) return mergedIntoColumnExists;
  try {
    const result = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'merged_into_channel_id'`
    );
    mergedIntoColumnExists = result.rows.length > 0;
  } catch (err) {
    // DB unavailable — don't cache, retry on the next call once it recovers
    return false;
  }
  return mergedIntoColumnExists;
}

async function checkChannelStreamsTable() {
  if (channelStreamsTableExists !== null) return channelStreamsTableExists;
  try {
    const result = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_streams'`
    );
    channelStreamsTableExists = result.rows.length > 0;
    return channelStreamsTableExists;
  } catch (err) {
    // DB unavailable — don't cache, retry on the next call once it recovers
    return false;
  }
  return channelStreamsTableExists;
}

async function checkChannelFailColumns() {
  if (channelFailColumnsExist !== null) return channelFailColumnsExist;
  try {
    const result = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'fail_count'`
    );
    channelFailColumnsExist = result.rows.length > 0;
  } catch (err) {
    // DB unavailable — don't cache, retry on the next call once it recovers
    return false;
  }
  return channelFailColumnsExist;
}

const formatChannelRow = (req, row) => {
  if (!row) return row;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  const localUrl = row.local_logo_url ? `${baseUrl}${row.local_logo_url}` : null;
  return {
    ...row,
    logo_url: localUrl || row.logo_url,
    local_logo_url: localUrl,
    logo_status: row.logo_status || 'unknown'
  };
};

// Normalize a raw language string to a canonical display name.
// Handles ISO codes (hin, ben, tam …) and common alternate spellings.
function normalizeLanguage(raw) {
  if (!raw) return null;
  const l = raw.trim().toLowerCase();
  const map = {
    // Hindi
    hindi: 'Hindi', hin: 'Hindi', hi: 'Hindi',
    // English
    english: 'English', eng: 'English', en: 'English',
    // Bengali
    bengali: 'Bengali', bangla: 'Bengali', ben: 'Bengali', bn: 'Bengali',
    // Tamil
    tamil: 'Tamil', tam: 'Tamil', ta: 'Tamil',
    // Telugu
    telugu: 'Telugu', tel: 'Telugu', te: 'Telugu',
    // Malayalam
    malayalam: 'Malayalam', mal: 'Malayalam', ml: 'Malayalam',
    // Kannada
    kannada: 'Kannada', kan: 'Kannada', kn: 'Kannada',
    // Marathi
    marathi: 'Marathi', mar: 'Marathi', mr: 'Marathi',
    // Punjabi
    punjabi: 'Punjabi', pan: 'Punjabi', pa: 'Punjabi',
    // Gujarati
    gujarati: 'Gujarati', guj: 'Gujarati', gu: 'Gujarati',
    // Odia
    odia: 'Odia', oriya: 'Odia', ori: 'Odia', or: 'Odia',
    // Assamese
    assamese: 'Assamese', asm: 'Assamese', as: 'Assamese',
    // Urdu
    urdu: 'Urdu', urd: 'Urdu', ur: 'Urdu',
    // Bhojpuri
    bhojpuri: 'Bhojpuri', bho: 'Bhojpuri',
    // Other South / North-East
    nepali: 'Nepali', nep: 'Nepali', ne: 'Nepali',
    sindhi: 'Sindhi', snd: 'Sindhi',
    konkani: 'Konkani', kok: 'Konkani',
    maithili: 'Maithili', mai: 'Maithili',
    dogri: 'Dogri', doi: 'Dogri',
    kashmiri: 'Kashmiri', ks: 'Kashmiri',
    manipuri: 'Manipuri', mni: 'Manipuri',
    bodo: 'Bodo', brx: 'Bodo',
    santhali: 'Santhali', sat: 'Santhali',
    khasi: 'Khasi',
    mizo: 'Mizo', lus: 'Mizo',
  };
  return map[l] || (raw.trim().length > 0 ? raw.trim() : null);
}

// PLAYABLE health statuses — strictly enforced for workingOnly=true
const WORKING_STATUSES = ['online', 'playable', 'stable'];
// Hidden health statuses — always hidden from normal users
const DEAD_STATUSES = ['offline', 'dead', 'forbidden_403', 'drm_or_unsupported', 'geo_blocked', 'requires_licensed_source', 'unstable', 'unknown', 'paid_blocked_scan'];

// Build the health_status filter fragment for workingOnly mode
function buildHealthFilter(paramIndex) {
  const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
  const params = [...WORKING_STATUSES];
  let fragment = `c.health_status IN (${statusList})`;
  const nextIndex = paramIndex + params.length;

  return { fragment, params, nextIndex };
}

// getChannels — main public API
// Supports: categoryId, language, workingOnly, search, page, limit, premium, featured, sort
exports.getChannels = async (req, res) => {
  try {
    const cache = require('../utils/cache');
    const cacheKey = 'channels_' + JSON.stringify(req.query);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const {
      category,       // legacy: ILIKE on category name (keep for backwards compat)
      categoryId,     // preferred: exact category_id match
      search,
      featured,
      popular,
      page,
      limit,
      country,
      language,
      showOffline,
      workingOnly,
      premium,        // 'true' | 'false' | 'all'
      genre,          // coarse 9-genre facet (News, Movies, Sports, …)
      quality,        // 'hd' | 'sd' | '4k' — resolution bucket filter
      region,           // 'world' allows showing international channels
      sort,           // recommended | popular | premium | az | recent | quality | stable | number | watched | updated
    } = req.query;

    const usePagination = page !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    console.log('[getChannels] filters:', {
      categoryId, category, language, workingOnly, showOffline, search, premium, region, page: pageNum
    });

    // Always exclude merged/duplicate/inactive/hidden channels
    const conditions = [
      `c.status = 'active'`,
      `c.is_hidden IS NOT TRUE`,
      `c.is_removed IS NOT TRUE`,
      `c.stream_url IS NOT NULL`,
      `c.stream_url != ''`,
    ];
    
    // Default mode: hide international channels (is_visible_app = false)
    if (region !== 'world') {
      conditions.push(`c.is_visible_app IS NOT FALSE`);
    }

    const params = [];
    let paramIndex = 1;

    // Guard: only add merged_into_channel_id IS NULL if column exists (migration 012)
    const hasMergedInto = await checkMergedIntoColumn();
    if (hasMergedInto) {
      conditions.unshift(`c.merged_into_channel_id IS NULL`);
    }

    const hasHealthStatus = await checkHealthStatusColumn();

    if (workingOnly === 'true') {
      if (hasHealthStatus) {
        const { fragment, params: hParams, nextIndex } = buildHealthFilter(paramIndex);
        // FILTER-03 FIX: Premium channels are no longer exempted from the health filter.
        // An offline premium channel shouldn't appear in "working only" mode — it will fail
        // to play and frustrate users. The health filter now applies to all channels equally.
        conditions.push(`(${fragment})`);
        params.push(...hParams);
        paramIndex = nextIndex;
      }
    } else if (showOffline !== 'true') {
      // Default mode: hide clearly dead channels, but ALWAYS allow paid/premium channels
      // even if scanner checks fail due to custom headers/token protection.
      if (hasHealthStatus) {
        const deadList = DEAD_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`(c.health_status IS NULL OR c.health_status NOT IN (${deadList}) OR c.is_premium = true OR c.is_paid = true)`);
        params.push(...DEAD_STATUSES);
        paramIndex += DEAD_STATUSES.length;
      }
    }
    // showOffline=true: no health filter (admin/debug mode)

    // Country filter
    if (country) {
      conditions.push(`c.country ILIKE $${paramIndex++}`);
      params.push(`%${country}%`);
    }

    // Language filter — exact normalized match
    if (language && language.trim().length > 0) {
      const normalizedLang = normalizeLanguage(language);
      if (normalizedLang) {
        conditions.push(`LOWER(c.language) = LOWER($${paramIndex++})`);
        params.push(normalizedLang);
      }
    }

    // Category filter — prefer exact categoryId, fallback to name ILIKE
    if (categoryId) {
      const catIdNum = parseInt(categoryId);
      if (!isNaN(catIdNum)) {
        conditions.push(`c.category_id = $${paramIndex++}`);
        params.push(catIdNum);
      }
    } else if (category) {
      conditions.push(`cat.name ILIKE $${paramIndex++}`);
      params.push(`%${category}%`);
    }

    // Premium filter
    if (premium === 'true') {
      conditions.push(`c.is_premium = true`);
    } else if (premium === 'false') {
      conditions.push(`(c.is_premium = false OR c.is_premium IS NULL)`);
    }
    // premium='all' or omitted: no filter

    // Genre filter — coarse 9-genre facet (exact match on the derived column)
    if (genre && genre.trim().length > 0) {
      conditions.push(`c.genre = $${paramIndex++}`);
      params.push(genre.trim());
    }

    // Quality filter — resolution buckets over the free-text quality column.
    // Buckets mirror the sort='quality' CASE above.
    if (quality && quality.trim().length > 0) {
      const q = quality.trim().toLowerCase();
      const qualityBuckets = {
        '4k': ['4k', 'uhd', '2160p'],
        hd:   ['hd', '720p', 'fhd', '1080p'],
        sd:   ['sd', '480p', '576p'],
      };
      const bucket = qualityBuckets[q];
      if (bucket) {
        const placeholders = bucket.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`LOWER(c.quality) IN (${placeholders})`);
        params.push(...bucket);
      }
    }
    if (featured === 'true' || popular === 'true') {
      if (featured === 'true') {
        conditions.push(`c.is_featured = true`);
      } else {
        // popular: is_popular OR featured OR has any popularity_score
        conditions.push(`(c.is_popular = true OR c.is_featured = true OR COALESCE(c.popularity_score, 0) > 0)`);
      }
    }

    // Search — across name, display_name, category name, language
    if (search && search.trim().length > 0) {
      conditions.push(
        `(c.name ILIKE $${paramIndex} OR c.display_name ILIKE $${paramIndex} OR c.language ILIKE $${paramIndex} OR cat.name ILIKE $${paramIndex})`
      );
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const joinClause = `LEFT JOIN categories cat ON c.category_id = cat.id`;
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Build ORDER BY based on ?sort= param (default: recommended)
    let orderClause;
    switch (sort) {
      case 'popular':
        orderClause = `ORDER BY COALESCE(c.popularity_score,0) DESC, COALESCE(c.watch_count,0) DESC, c.name ASC`;
        break;
      case 'premium':
        orderClause = `ORDER BY CASE WHEN c.is_premium=true THEN 0 ELSE 1 END, COALESCE(c.popularity_score,0) DESC, c.name ASC`;
        break;
      case 'az':
        orderClause = `ORDER BY c.name ASC`;
        break;
      case 'recent':
        orderClause = `ORDER BY c.created_at DESC NULLS LAST, c.name ASC`;
        break;
      case 'number':
        orderClause = `ORDER BY c.channel_number ASC NULLS LAST, c.name ASC`;
        break;
      case 'watched':
        orderClause = `ORDER BY COALESCE(c.watch_count,0) DESC, COALESCE(c.popularity_score,0) DESC, c.name ASC`;
        break;
      case 'updated':
        orderClause = `ORDER BY c.updated_at DESC NULLS LAST, c.name ASC`;
        break;
      case 'quality':
        orderClause = `ORDER BY CASE WHEN LOWER(c.quality) IN ('4k','uhd','2160p') THEN 0 WHEN LOWER(c.quality) IN ('fhd','1080p') THEN 1 WHEN LOWER(c.quality) IN ('hd','720p') THEN 2 WHEN LOWER(c.quality) IN ('sd','480p','576p') THEN 3 ELSE 4 END, c.name ASC`;
        break;
      case 'stable':
        orderClause = `ORDER BY COALESCE(c.health_score,0) DESC, COALESCE(c.popularity_score,0) DESC, c.name ASC`;
        break;
      case 'recommended':
      default:
        // DTH recommended: premium first → featured → popularity → watch count → health → sort_order → alpha
        orderClause = `ORDER BY
          CASE WHEN c.is_premium=true THEN 0 ELSE 1 END,
          CASE WHEN c.is_featured=true THEN 0 ELSE 1 END,
          COALESCE(c.popularity_score,0) DESC NULLS LAST,
          COALESCE(c.watch_count,0) DESC NULLS LAST,
          COALESCE(c.health_score,0) DESC NULLS LAST,
          COALESCE(c.sort_order,999) ASC NULLS LAST,
          c.name ASC`;
    }

    if (usePagination) {
      const offset = (pageNum - 1) * limitNum;

      const [countResult, dataResult] = await Promise.all([
        db.query(`SELECT COUNT(*) FROM channels c ${joinClause} ${whereClause}`, params),
        db.query(
          `SELECT c.*, cat.name as category_name FROM channels c ${joinClause} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, limitNum, offset]
        ),
      ]);

      const total = parseInt(countResult.rows[0].count, 10);
      const formatted = dataResult.rows.map(row => formatChannelRow(req, row));

      console.log(`[getChannels] total=${total}, returned=${formatted.length}, page=${pageNum}`);
      if (formatted.length > 0) {
        console.log('[getChannels] sample (first 5):',
          formatted.slice(0, 5).map(c => `${c.name} | cat=${c.category_name} | lang=${c.language} | health=${c.health_status}`)
        );
      }

      const responseData = {
        success: true,
        data: formatted,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: offset + dataResult.rows.length < total,
        },
        filters: {
          categoryId: categoryId || null,
          language: language || null,
          genre: genre || null,
          quality: quality || null,
          workingOnly: workingOnly === 'true',
          premium: premium || 'all',
          search: search || null,
          sort: sort || 'recommended',
        },
      };
      
      cache.set(cacheKey, responseData, 60);
      return res.json(responseData);
    }

    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c ${joinClause} ${whereClause} ${orderClause}`,
      params
    );
    const formatted = result.rows.map(row => formatChannelRow(req, row));
    const responseData = { success: true, data: formatted };
    cache.set(cacheKey, responseData, 60);
    return res.json(responseData);
  } catch (err) {
    console.error('getChannels error:', err);
    error(res, 'Failed to fetch channels', 500);
  }
};

exports.updateChannelsByStream = async () => {
  try {
    await db.query(
      'UPDATE channels SET status = $1 WHERE stream_url IS NULL OR stream_url = $2',
      ['inactive', '']
    );
    console.log('Channels with missing stream URLs successfully updated to inactive.');
  } catch (err) {
    console.error('updateChannelsByStream error:', err);
  }
}

exports.getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1 
         AND c.status = 'active'
         AND c.is_hidden IS NOT TRUE 
         AND c.is_removed IS NOT TRUE`,
      [id]
    );
    if (result.rows.length === 0) {
      return error(res, 'Channel not found', 404);
    }
    success(res, formatChannelRow(req, result.rows[0]));
  } catch (err) {
    console.error('getChannel error:', err);
    error(res, 'Failed to fetch channel', 500);
  }
};

exports.searchChannels = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return success(res, []);
    }
    // Fix #12: Removed dead code `AND c.status NOT IN ('merged','duplicate','inactive')`.
    // It was redundant — `status = 'active'` already excludes those values.
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.status = 'active'
         AND c.is_hidden IS NOT TRUE
         AND c.is_removed IS NOT TRUE
         AND c.is_visible_app IS NOT FALSE
         AND (c.name ILIKE $1 OR c.display_name ILIKE $1 OR cat.name ILIKE $1 OR c.language ILIKE $1)
       ORDER BY c.name ASC`,
      [`%${q}%`]
    );
    const formatted = result.rows.map(row => formatChannelRow(req, row));
    success(res, formatted);
  } catch (err) {
    console.error('searchChannels error:', err);
    error(res, 'Failed to search channels', 500);
  }
};

exports.getChannelsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const hasHealthStatus = await checkHealthStatusColumn();
    // Fix #13: Add health filter to category endpoint — previously it returned all channels
    // including offline/dead/geo-blocked ones, causing broken streams in category view.
    // Mirrors the default-mode filter in getChannels (excludes clearly dead, shows unknown).
    const healthClause = hasHealthStatus
      ? `AND (c.health_status IS NULL OR c.health_status NOT IN (${DEAD_STATUSES.map((_, i) => `$${i + 2}`).join(', ')}) OR c.is_premium = true OR c.is_paid = true)`
      : '';
    const params = hasHealthStatus ? [categoryId, ...DEAD_STATUSES] : [categoryId];
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.category_id = $1
         AND c.status = 'active'
         AND c.is_hidden IS NOT TRUE
         AND c.is_removed IS NOT TRUE
         AND c.is_visible_app IS NOT FALSE
         ${healthClause}
       ORDER BY c.sort_order ASC, c.name ASC`,
      params
    );
    const formatted = result.rows.map(row => formatChannelRow(req, row));
    success(res, formatted);
  } catch (err) {
    console.error('getChannelsByCategory error:', err);
    error(res, 'Failed to fetch channels by category', 500);
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { workingOnly, language } = req.query;
    const hasHealthStatus = await checkHealthStatusColumn();

    let channelFilter = `ch.status = 'active' AND ch.stream_url IS NOT NULL AND ch.stream_url != '' AND ch.is_hidden IS NOT TRUE AND ch.is_removed IS NOT TRUE AND ch.is_visible_app IS NOT FALSE`;

    const params = [];
    let paramIndex = 1;

    if (workingOnly === 'true' && hasHealthStatus) {
      const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
      let healthPart = `ch.health_status IN (${statusList})`;
      if (ALLOW_UNKNOWN) {
        healthPart = `(${healthPart} OR ch.health_status IS NULL OR ch.health_status = 'unknown')`;
      }
      channelFilter += ` AND ${healthPart}`;
      params.push(...WORKING_STATUSES);
      paramIndex += WORKING_STATUSES.length;
    } else if (workingOnly !== 'false' && req.query.showOffline !== 'true' && hasHealthStatus) {
      const deadList = DEAD_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
      channelFilter += ` AND (ch.health_status IS NULL OR ch.health_status NOT IN (${deadList}))`;
      params.push(...DEAD_STATUSES);
      paramIndex += DEAD_STATUSES.length;
    }

    if (language && language.trim()) {
      channelFilter += ` AND LOWER(TRIM(ch.language)) = LOWER($${paramIndex})`;
      params.push(language.trim());
      paramIndex++;
    }

    const result = await db.query(
      `SELECT cat.id, cat.name, cat.icon_url, cat.status, cat.sort_order,
              COUNT(ch.id)::int as channel_count
       FROM categories cat
       LEFT JOIN channels ch ON cat.id = ch.category_id AND (${channelFilter})
       WHERE cat.status = 'active'
       GROUP BY cat.id
       HAVING COUNT(ch.id) > 0
       ORDER BY cat.sort_order ASC, cat.name ASC`,
      params
    );
    success(res, result.rows);
  } catch (err) {
    console.error('getCategories error:', err);
    error(res, 'Failed to fetch categories', 500);
  }
};

exports.getLanguages = async (req, res) => {
  try {
    const { workingOnly, categoryId } = req.query;
    const hasHealthStatus = await checkHealthStatusColumn();

    let channelFilter = `c.status = 'active' AND c.stream_url IS NOT NULL AND c.stream_url != '' AND c.language IS NOT NULL AND c.language != '' AND c.is_hidden IS NOT TRUE AND c.is_removed IS NOT TRUE AND c.is_visible_app IS NOT FALSE`;
    const params = [];
    let paramIndex = 1;

    if (workingOnly === 'true' && hasHealthStatus) {
      const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
      let healthPart = `c.health_status IN (${statusList})`;
      if (ALLOW_UNKNOWN) {
        healthPart = `(${healthPart} OR c.health_status IS NULL OR c.health_status = 'unknown')`;
      }
      channelFilter += ` AND ${healthPart}`;
      params.push(...WORKING_STATUSES);
      paramIndex += WORKING_STATUSES.length;
    } else if (workingOnly !== 'false' && req.query.showOffline !== 'true' && hasHealthStatus) {
      const deadList = DEAD_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
      channelFilter += ` AND (c.health_status IS NULL OR c.health_status NOT IN (${deadList}) OR c.is_premium = true OR c.is_paid = true OR c.is_popular = true OR c.is_featured = true)`;
      params.push(...DEAD_STATUSES);
      paramIndex += DEAD_STATUSES.length;
    }

    const catIdInt = categoryId ? parseInt(categoryId, 10) : NaN;
    if (!isNaN(catIdInt) && catIdInt > 0) {
      channelFilter += ` AND c.category_id = $${paramIndex}`;
      params.push(catIdInt);
      paramIndex++;
    }

    const result = await db.query(
      `SELECT
         INITCAP(LOWER(TRIM(c.language))) as name,
         COUNT(*)::int as channel_count
       FROM channels c
       WHERE ${channelFilter}
       GROUP BY LOWER(TRIM(c.language))
       HAVING COUNT(*) > 0
       -- 'Unknown' is a real bucket but always sorts to the very end of the chips
       ORDER BY (LOWER(TRIM(c.language)) = 'unknown') ASC, COUNT(*) DESC, LOWER(TRIM(c.language)) ASC`,
      params
    );
    success(res, result.rows);
  } catch (err) {
    console.error('getLanguages error:', err);
    error(res, 'Failed to fetch languages', 500);
  }
};

exports.getChannelEPGNow = async (req, res) => {
  try {
    const { id } = req.params;

    // Get channel info for fallback
    const channelRes = await db.query(
      'SELECT name, category_id, language FROM channels WHERE id = $1',
      [id]
    );
    const channel = channelRes.rows[0] || { name: 'Channel', category_id: null, language: null };

    // Find current program
    const result = await db.query(
      `SELECT * FROM epg_programs
       WHERE channel_id = $1
       AND NOW() BETWEEN start_time AND end_time
       ORDER BY start_time DESC
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      // Build fallback description based on category
      const catRes = await db.query('SELECT name FROM categories WHERE id = $1', [channel.category_id]);
      const categoryName = catRes.rows[0]?.name?.toLowerCase() || '';

      // Fallback description keyed on the GLOBAL content category (language-agnostic).
      let fallbackDesc = 'Schedule information is not available.';
      if (categoryName.includes('news')) {
        fallbackDesc = 'Watch live news, breaking updates, politics, business and current affairs.';
      } else if (categoryName.includes('movies')) {
        fallbackDesc = 'Watch live movies and premieres.';
      } else if (categoryName.includes('sports')) {
        fallbackDesc = 'Watch live sports coverage and sports updates.';
      } else if (categoryName.includes('music')) {
        fallbackDesc = 'Watch live music, songs and entertainment.';
      } else if (categoryName.includes('devotional')) {
        fallbackDesc = 'Watch live devotional and spiritual programming.';
      } else if (categoryName.includes('kids')) {
        fallbackDesc = 'Watch live kids shows, cartoons and animation.';
      } else if (categoryName.includes('doordarshan')) {
        fallbackDesc = 'Watch live Doordarshan broadcast.';
      } else if (categoryName.includes('entertainment') || categoryName.includes('regional')) {
        fallbackDesc = 'Watch live entertainment, shows and serials.';
      }

      return success(res, {
        title: `Live: ${channel.name}`,
        description: fallbackDesc,
        start_time: null,
        end_time: null,
        progress: 0
      });
    }

    const prog = result.rows[0];
    const now = Date.now();
    const start = new Date(prog.start_time).getTime();
    const end = new Date(prog.end_time).getTime();

    let progress = 0;
    if (end > start) {
      progress = Math.min(Math.max((now - start) / (end - start), 0), 1);
    }

    success(res, {
      id: prog.id,
      channel_id: prog.channel_id,
      title: prog.title,
      description: prog.description || "",
      start_time: prog.start_time,
      end_time: prog.end_time,
      progress: parseFloat(progress.toFixed(2))
    });
  } catch (err) {
    console.error('getChannelEPGNow error:', err);
    error(res, 'Failed to fetch EPG now playing', 500);
  }
};

exports.getChannelEPGUpcoming = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM epg_programs
       WHERE channel_id = $1
       AND start_time > NOW()
       ORDER BY start_time ASC
       LIMIT 5`,
      [id]
    );

    // If no upcoming programs found, return empty array for Flutter to handle fallback
    success(res, result.rows);
  } catch (err) {
    console.error('getChannelEPGUpcoming error:', err);
    error(res, 'Failed to fetch EPG upcoming', 500);
  }
};

exports.getRelatedChannels = async (req, res) => {
  try {
    const { id } = req.params;

    // Find current channel with category name
    const channelRes = await db.query(
      `SELECT c.id, c.category_id, c.language, c.name, cat.name as category_name
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1`,
      [id]
    );

    if (channelRes.rows.length === 0) {
      return error(res, 'Channel not found', 404);
    }

    const currentChannel = channelRes.rows[0];
    const { category_id, name } = currentChannel;

    // Use the channel's normalized language as-is. Do NOT derive from the category
    // name and do NOT default to Hindi — 'Unknown'/empty simply means the
    // language tiers are skipped (category + popularity carry the ranking).
    const rawLang = (currentChannel.language || '').trim();
    const hasLanguage = rawLang.length > 0 && rawLang.toLowerCase() !== 'unknown';

    const seenIds = new Set([currentChannel.id]);
    const LIMIT = 20;

    // Check if health_status column exists for filtering
    const hasHealthStatus = await checkHealthStatusColumn();
    // Exclude clearly-dead streams from related suggestions (mirrors listing filter)
    const healthFilter = hasHealthStatus
      ? `AND (c.health_status IS NULL OR c.health_status NOT IN (${DEAD_STATUSES.map((_, i) => `'${DEAD_STATUSES[i]}'`).join(', ')}))`
      : '';

    const baseSelect = `SELECT c.*, cat.name as category_name
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id != $1
       AND c.status = 'active'
       AND c.is_hidden IS NOT TRUE
       AND c.is_removed IS NOT TRUE
       AND c.is_visible_app IS NOT FALSE
       AND c.stream_url IS NOT NULL AND c.stream_url != ''
       ${healthFilter}`;
    const orderBy = `ORDER BY c.is_featured DESC NULLS LAST,
                     COALESCE(c.popularity_score,0) DESC NULLS LAST,
                     COALESCE(c.watch_count,0) DESC NULLS LAST,
                     COALESCE(c.sort_order,999) ASC, c.name ASC`;

    // Fetch the four priority tiers in parallel, then merge in strict priority order.
    const noRows = Promise.resolve({ rows: [] });
    const [tier1, tier2, tier3, tier4] = await Promise.all([
      // Tier 1 — same category AND same language
      (category_id && hasLanguage) ? db.query(
        `${baseSelect} AND c.category_id = $2 AND LOWER(TRIM(c.language)) = LOWER($3) ${orderBy} LIMIT ${LIMIT}`,
        [id, category_id, rawLang]
      ) : noRows,
      // Tier 2 — same category, any language
      category_id ? db.query(
        `${baseSelect} AND c.category_id = $2 ${orderBy} LIMIT ${LIMIT}`,
        [id, category_id]
      ) : noRows,
      // Tier 3 — same language, any category
      hasLanguage ? db.query(
        `${baseSelect} AND LOWER(TRIM(c.language)) = LOWER($2) ${orderBy} LIMIT ${LIMIT}`,
        [id, rawLang]
      ) : noRows,
      // Tier 4 — popular / featured fallback
      db.query(`${baseSelect} ${orderBy} LIMIT ${LIMIT}`, [id]),
    ]);

    const picked = [];
    let sameCatSameLang = 0, sameCategory = 0, sameLanguage = 0, fallback = 0;
    const addTier = (rows, kind) => {
      for (const row of rows) {
        if (picked.length >= LIMIT) break;
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        picked.push({ ...row, source_type: kind });
        if (kind === 'same_category_language') sameCatSameLang++;
        else if (kind === 'same_category') sameCategory++;
        else if (kind === 'same_language') sameLanguage++;
        else fallback++;
      }
    };

    addTier(tier1.rows, 'same_category_language'); // 1. same category + same language
    addTier(tier2.rows, 'same_category');          // 2. same category, other languages
    addTier(tier3.rows, 'same_language');           // 3. same language, other categories
    addTier(tier4.rows, 'fallback_popular');        // 4. popular fallback

    // Overall source_type reflects the strongest tier that produced results
    let responseSourceType = 'fallback_popular';
    if (sameCatSameLang > 0) responseSourceType = 'same_category_language';
    else if (sameCategory > 0) responseSourceType = 'same_category';
    else if (sameLanguage > 0) responseSourceType = 'same_language';

    const formatted = picked.slice(0, LIMIT).map(row => formatChannelRow(req, row));

    success(res, {
      channels: formatted,
      source_type: responseSourceType,
      same_category_language_count: sameCatSameLang,
      same_category_count: sameCatSameLang + sameCategory,
      same_language_count: sameLanguage,
      fallback_count: fallback,
    });
  } catch (err) {
    console.error('getRelatedChannels error:', err);
    error(res, 'Failed to fetch related channels', 500);
  }
};

exports.reportFailure = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reason, stream_url, stream_id, buffer_seconds,
      device, player, message, network_type, android_version,
      quality, has_played_once, playback_path,
      failureCode, activeState, generation
    } = req.body;

    console.info(`[report_failure] channel=${id} stream=${stream_id} reason=${reason} code=${failureCode} state=${activeState} gen=${generation} path=${playback_path}`);

    const failReason = reason || message || 'buffer_timeout';
    const failDescription = [message || 'Failed to load stream', playback_path ? `path:${playback_path}` : null].filter(Boolean).join(' ');

    // ── Step 1: Update per-stream health (most granular) ────────────────────
    const hasStreamsTable = await checkChannelStreamsTable();
    let resolvedStreamId = stream_id || null;

    if (hasStreamsTable) {
      if (!resolvedStreamId && stream_url) {
        const sr = await db.query(
          'SELECT id FROM channel_streams WHERE channel_id = $1 AND stream_url = $2 LIMIT 1',
          [id, stream_url]
        );
        if (sr.rows.length > 0) resolvedStreamId = sr.rows[0].id;
      }

      if (resolvedStreamId) {
        const upd = await db.query(`
          UPDATE channel_streams
          SET fail_count    = COALESCE(fail_count, 0) + 1,
              health_score  = GREATEST(0, COALESCE(health_score, 100) - 15),
              last_failed_at = NOW(),
              health_reason  = $1
          WHERE id = $2
          RETURNING fail_count, health_score, health_status
        `, [failReason, resolvedStreamId]);

        if (upd.rows.length > 0) {
          const { fail_count: fc, health_score: hs } = upd.rows[0];
          if (fc >= 4 || hs <= 0) {
            await db.query(
              `UPDATE channel_streams SET health_status = 'unstable' WHERE id = $1`,
              [resolvedStreamId]
            );
          } else if (fc >= 2 || hs <= 40) {
            await db.query(
              `UPDATE channel_streams SET health_status = 'unstable' WHERE id = $1`,
              [resolvedStreamId]
            );
          }
        }
      }
    }

    // ── Step 2: Update channel-level fail count ──────────────────────────────
    const hasFailColumns = await checkChannelFailColumns();
    if (hasFailColumns) {
      const chanUpd = await db.query(`
        UPDATE channels
        SET fail_count      = COALESCE(fail_count, 0) + 1,
            last_failure_at = NOW(),
            failure_reason  = $1
        WHERE id = $2
        RETURNING fail_count, health_status, is_featured, is_popular, is_premium
      `, [failReason, id]);

      if (chanUpd.rows.length > 0) {
        const { fail_count: fc, health_status: cur, is_featured, is_popular, is_premium } = chanUpd.rows[0];
        const isImportant = is_featured || is_popular || is_premium;
        const hasHS = await checkHealthStatusColumn();

        if (hasHS) {
          // Smart threshold — escalate status gradually, never instantly hide
          let newStatus = null;
          if (fc >= 7 && !isImportant) {
            newStatus = 'likely_broken';         // heavy repeated failures — admin candidate
          } else if (fc >= 3 && cur === 'online') {
            newStatus = 'unstable';
          } else if (fc >= 1 && cur === 'online') {
            newStatus = 'needs_review';          // soft flag, still shows to users
          }

          if (newStatus) {
            await db.query(
              `UPDATE channels SET health_status = $1 WHERE id = $2`,
              [newStatus, id]
            );
          }

          // Important channels: set needs_manual_verification, do NOT escalate to broken/offline
          if (isImportant && fc >= 3) {
            await db.query(
              `UPDATE channels SET needs_manual_verification = true WHERE id = $1`,
              [id]
            );
          }
        }
      }
    }

    // ── Step 3: Log to channel_reports for admin review ─────────────────────
    try {
      await db.query(`
        INSERT INTO channel_reports
          (channel_id, stream_id, device_id, issue_type, description, status,
           quality, network_type, android_version, player_error,
           has_played_once, buffer_seconds)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11)
      `, [
        id,
        resolvedStreamId,
        device || null,
        failReason,
        failDescription,
        quality || null,
        network_type || null,
        android_version || null,
        player || null,
        has_played_once === true || has_played_once === 'true',
        parseInt(buffer_seconds) || 0,
      ]);
    } catch (_) {
      // channel_reports might not have stream_id column yet (migration 031 not run)
      // Fall back to basic insert
      await db.query(`
        INSERT INTO channel_reports (channel_id, device_id, issue_type, description, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [id, device || null, failReason, failDescription]).catch(() => {});
    }

    success(res, { success: true, message: 'Failure reported' });
  } catch (err) {
    console.error('reportFailure error:', err);
    error(res, 'Failed to report', 500);
  }
};

// Health statuses that make a channel ineligible for proxy (DRM, geo-block, unlicensed)
const PROXY_BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);

exports.getChannelPlayback = async (req, res) => {
  try {
    const { id } = req.params;

    // Build base URL for proxy links
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Fix #26: Use cached table check
    const hasStreamsTable = await checkChannelStreamsTable();

    // ── Guard: channel must be visible ──────────────────────────────────────
    // Hidden / removed channels must not be playable from the public API
    const channelRes = await db.query(
      `SELECT c.*, cat.name AS category_name
       FROM channels c
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.id = $1`,
      [id]
    );
    if (channelRes.rows.length === 0) {
      return error(res, 'Channel not found', 404);
    }
    const channel = channelRes.rows[0];
    if (channel.is_hidden || channel.is_removed || channel.is_visible_app === false) {
      return res.status(403).json({
        success: false,
        message: 'Channel is not available.',
        error_code: 'CHANNEL_NOT_AVAILABLE',
      });
    }

    // ── Enforce Channel Tier ──────────────────────────────────────────────
    // If the channel requires a specific tier, verify the user's license.
    if (channel.channel_tier === 'pro' || channel.channel_tier === 'plus') {
      let allowed = false;
      if (req.user) {
        // Look up the user's active license and plan tier
        const licenseRes = await db.query(
          `SELECT p.plan_tier 
           FROM licenses l 
           JOIN plans p ON l.plan_id = p.id 
           WHERE l.user_id = $1 
             AND l.status IN ('active', 'trial') 
             AND l.expires_at > NOW() 
           ORDER BY p.price DESC LIMIT 1`,
          [req.user.id]
        );
        
        if (licenseRes.rows.length > 0) {
          const planTier = licenseRes.rows[0].plan_tier;
          if (channel.channel_tier === 'plus' && planTier === 'plus') {
            allowed = true;
          } else if (channel.channel_tier === 'pro' && (planTier === 'pro' || planTier === 'plus')) {
            allowed = true;
          }
        }
      }

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'This channel requires an upgraded plan.',
          error_code: 'upgrade_required',
        });
      }
    }

    // ── Entitlement guard: premium/paid channels require an authenticated
    // user with an active, non-expired license before any stream/proxy URLs
    // are returned. Free-tier channels keep the existing anonymous access.
    const isPremiumChannel = channel.is_premium === true || channel.is_paid === true;
    if (isPremiumChannel) {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Sign in required to play this premium channel.',
          error_code: 'AUTH_REQUIRED',
        });
      }

      const licenseRes = await db.query(
        `SELECT 1 FROM licenses
         WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
         LIMIT 1`,
        [req.user.id]
      );
      if (licenseRes.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'An active subscription is required to play this premium channel.',
          error_code: 'LICENSE_REQUIRED',
        });
      }
    }

    // ── Helper: compile safe headers for a stream row ───────────────────────
    // Only include User-Agent when the stream row explicitly sets one — avoids
    // sending a desktop Chrome UA to CDNs that expect a mobile/native UA or no UA.
    // Only include Referer/Origin when explicitly set (non-empty) — sending an
    // unwanted Referer to hotlink-protected CDNs causes 403s that VLC avoids by
    // sending nothing. Null/empty = intentional omission, not a missing value.
    const compileHeaders = (stream) => {
      const h = {};
      const ua = stream.user_agent && stream.user_agent.trim();
      if (ua) h['User-Agent'] = ua;
      const referer = stream.referer && stream.referer.trim();
      if (referer) h['Referer'] = referer;
      const origin = stream.origin && stream.origin.trim();
      if (origin) h['Origin'] = origin;
      if (stream.headers_json && typeof stream.headers_json === 'object') {
        Object.assign(h, stream.headers_json);
      }
      return h;
    };

    // ── Helper: resolve the play URL for a stream ────────────────────────────
    // Always return the direct CDN URL so the app can play without a backend hop.
    // proxy_url is returned as a separate fallback field — the app uses it only
    // after the direct URL has already failed all retries.
    const getPlayUrl = (stream) => {
      return stream.final_url || stream.stream_url;
    };

    // ── Determine proxy eligibility ──────────────────────────────────────────
    // proxy_url is returned ONLY when the channel is legal/public/licensed
    // and not DRM/geo-blocked/unauthorized
    const isProxyEligible = (streamRow) => {
      if (!streamRow?.id) return false;
      if (PROXY_BLOCKED_STATUSES.has(channel.health_status)) return false;
      if (PROXY_BLOCKED_STATUSES.has(streamRow.health_status)) return false;
      const licType = streamRow.license_type || 'free';
      // Allow free, public, or licensed; block paid-only, drm, etc.
      return licType === 'free' || licType === 'licensed' || licType === 'public';
    };

    // ── Fallback: no channel_streams table ──────────────────────────────────
    if (!hasStreamsTable) {
      const defaultHeaders = {
        'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(channel.referrer ? { 'Referer': channel.referrer } : {}),
      };
      return success(res, {
        channel_id: parseInt(id),
        channel: { id: parseInt(id), name: channel.name || 'Unknown Channel' },
        qualities: [{ label: 'Auto', url: channel.stream_url, type: 'auto', headers: defaultHeaders }],
        primary_stream: { url: channel.stream_url, quality: 'auto', headers: defaultHeaders, playback_mode: 'direct' },
        backup_streams: channel.backup_stream_url
          ? [{ url: channel.backup_stream_url, quality: 'auto', headers: defaultHeaders }]
          : [],
        recommended_buffer_profile: 'stable',
        proxy_url: null,
        health_status: channel.health_status || 'unknown',
        health_score: channel.health_score || 50,
      });
    }

    // Fix: Exclude known-dead statuses — 'segment_failed', 'offline', 'dead',
    // 'forbidden_403', 'geo_blocked' — from playback so the app never tries a broken stream.
    // Also use explicit NULL check since NULL != 'offline' evaluates to NULL in PG.
    let result = await db.query(`
      SELECT cs.*
      FROM channel_streams cs
      WHERE cs.channel_id = $1
        AND cs.is_hidden IS NOT TRUE
      ORDER BY
        -- 1. Favor streams with recent success over recent failure. A stream with 1 old failure and recent success will rank well here.
        CASE WHEN COALESCE(cs.last_success_at, '1970-01-01') >= COALESCE(cs.last_failed_at, '1970-01-01') THEN 0 ELSE 1 END ASC,
        -- 2. Sort by lowest failures first (fewer consecutive/overall segment failures is better)
        COALESCE(cs.fail_count, 0) ASC,
        COALESCE(cs.segment_failure_count, 0) ASC,
        -- 3. Factor in real Android playback success (streams that have played for 5 mins are highly stable)
        COALESCE(cs.played_5min_count, 0) DESC,
        COALESCE(cs.startup_success_count, 0) DESC,
        -- 4. Stability score computed by backend
        COALESCE(cs.stability_score, 50) DESC,
        -- 5. Editor priority
        cs.priority ASC,
        -- 6. Overall channel health status
        CASE cs.health_status
          WHEN 'online'   THEN 5
          WHEN 'unstable' THEN 4
          WHEN 'unknown'  THEN 3
          WHEN 'pending_check' THEN 2
          ELSE 1 -- offline, dead, likely_broken fall to the bottom
        END DESC,
        COALESCE(cs.health_score, 50) DESC
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: false,
        code: 'no_working_source',
        message: 'No stable source is available right now',
      });
    }

    // ── Identify primary stream (no parent = standalone / master playlist) ──
    // Helper: detect audio-only sub-track URLs (e.g. tracks-v1a1/mono.m3u8).
    // These are HLS rendition sub-playlists — playing them as primary gives
    // audio-only output, causing the video player to show black screen and
    // then fall back to whatever was previously playing (wrong channel content).
    const isAudioOnlyTrack = (r) => {
      const url = (r.stream_url || r.final_url || '').toLowerCase();
      return (
        url.includes('/tracks-v') ||
        url.includes('/mono.m3u8') ||
        url.includes('/stereo.m3u8') ||
        url.includes('audio_only') ||
        url.includes('audio-only') ||
        (url.includes('audio') && url.includes('/tracks'))
      );
    };

    // Priority 1: online/unknown primary stream (not audio-only)
    let primary = result.rows.find(r => r.is_primary === true && !isAudioOnlyTrack(r) && r.health_status !== 'offline');
    // Priority 2: online/unknown top-level stream (not audio-only)
    if (!primary) primary = result.rows.find(r => r.parent_stream_id == null && !isAudioOnlyTrack(r) && r.health_status !== 'offline');
    // Priority 3: any primary stream
    if (!primary) primary = result.rows.find(r => r.is_primary === true && !isAudioOnlyTrack(r));
    // Priority 4: any top-level stream
    if (!primary) primary = result.rows.find(r => r.parent_stream_id == null && !isAudioOnlyTrack(r));
    // Last resort: first stream returned
    if (!primary) primary = result.rows[0];

    // Log when audio-only fallback happens so we can fix the DB
    if (primary && isAudioOnlyTrack(primary)) {
      console.warn(`[playback] WARNING: channel ${id} primary stream ${primary.id} looks audio-only: ${(primary.stream_url || '').substring(0, 80)}`);
      
      // Auto-correct standard HLS audio sub-tracks back to their master playlist
      // e.g. https://domain.com/path/tracks-v1a1/mono.m3u8 -> https://domain.com/path/index.m3u8
      const fixUrl = (url) => {
        if (!url) return url;
        // Fix standard Mux/Amagi/generic tracks structure
        if (url.match(/\/tracks-[^/]+\/[^/]+\.m3u8$/i)) {
          return url.replace(/\/tracks-[^/]+\/[^/]+\.m3u8$/i, '/index.m3u8');
        }
        return url;
      };

      if (primary.stream_url) primary.stream_url = fixUrl(primary.stream_url);
      if (primary.final_url) primary.final_url = fixUrl(primary.final_url);
      
      console.log(`[playback] Auto-corrected audio track to master playlist: ${primary.stream_url}`);
    }

    // ── Build quality variants list ──────────────────────────────────────────
    // REAL variants only: child rows (parent_stream_id = primary.id) with known height.
    // Do NOT add fake 360p/480p rows. Auto is always included.
    const variantRows = result.rows.filter(
      r => r.parent_stream_id === primary.id && (r.resolution_height ?? 0) > 0
    );

    const qualities = [
      { label: 'Auto', url: getPlayUrl(primary), type: 'auto', headers: compileHeaders(primary) },
      ...variantRows
        .sort((a, b) => (b.resolution_height || 0) - (a.resolution_height || 0))
        .map(v => ({
          type: 'fixed',
          label: v.quality_label || `${v.resolution_height}p`,
          url: getPlayUrl(v),
          height: v.resolution_height,
          bitrate: v.bitrate || null,
          headers: compileHeaders(v),
          health_status: v.health_status || 'unknown',
        })),
    ];

    // ── Backup streams (other top-level streams, not variants of primary) ───
    let backups = result.rows
      .filter(r => r.id !== primary.id && r.parent_stream_id == null)
      .map(r => ({
        id: r.id,
        url: getPlayUrl(r),
        quality: r.quality || 'auto',
        headers: compileHeaders(r),
        health_status: r.health_status || 'unknown',
        health_score: r.health_score ?? 50,
      }));

    // If no clean backups exist, include all non-dead streams as last-resort backups
    if (backups.length === 0) {
      backups = result.rows
        .filter(r => r.id !== primary.id)
        .map(r => ({
          id: r.id,
          url: getPlayUrl(r),
          quality: r.quality || 'auto',
          headers: compileHeaders(r),
          health_status: r.health_status || 'unknown',
          health_score: r.health_score ?? 50,
        }));
    }
    
    // Emergency fallback: If still no backups and channels.stream_url exists and is different from primary
    if (backups.length === 0 && channel.stream_url && channel.stream_url !== getPlayUrl(primary)) {
      backups.push({
        id: 'fallback_channel_url',
        url: channel.stream_url,
        quality: 'auto',
        headers: {
          'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(channel.referrer ? { 'Referer': channel.referrer } : {}),
        },
        health_status: channel.health_status || 'unknown',
        health_score: 50,
      });
    }

    // ── Recommended buffer profile based on health score ────────────────────
    const primaryScore = primary.health_score ?? 50;
    const recommendedProfile = primaryScore >= 85 ? 'fast' : 'stable';

    // ── Proxy URL — only for eligible legal/public streams ──────────────────
    const proxyEligible = isProxyEligible(primary);
    let proxyUrl = null;
    if (proxyEligible) {
      // Generate a server-issued session token for the proxy.
      // This allows the proxy to validate access without relying on the generic IP-cache
      // or expecting the browser to pass the JWT via headers to every nested HLS segment.
      // req.user.id is available from the authMiddleware.
      const proxySessionToken = generateProxySessionToken(req.user?.id || 'anon', primary.id, '6h');
      proxyUrl = `${baseUrl}/api/proxy/${primary.id}/master.m3u8?token=${proxySessionToken}`;
    }

    // ── Playback Path Recommendation ────────────────────────────────────────
    let preferredMode = 'direct';
    let recReason = 'default';
    if (primary.health_status === 'unstable' && proxyEligible) {
      preferredMode = 'proxy';
      recReason = 'stream_unstable';
    }

    success(res, {
      channel_id: parseInt(id),
      channel: { id: parseInt(id), name: channel.name || 'Unknown Channel' },
      qualities,
      session_id: crypto.randomUUID(),
      primary_stream: {
        id: primary.id,
        url: getPlayUrl(primary),
        final_url: primary.final_url || primary.stream_url || null,
        quality: primary.quality || 'auto',
        headers: compileHeaders(primary),
        playback_mode: primary.playback_mode || 'direct',
        health_status: primary.health_status || 'unknown',
        health_score: primaryScore,
      },
      backup_streams: backups,
      // ── New fields for Flutter playback profile system ──
      recommended_buffer_profile: recommendedProfile,
      proxy_url: proxyUrl,           // null when DRM/geo/hidden/unlicensed
      recommendation: {
        preferred_mode: preferredMode,
        reason: recReason,
        stream_id: primary.id,
      },
      health_status: channel.health_status || 'unknown',
      health_score: channel.health_score ?? 50,
      retry_after_ms: 2000,

      // ── Smooth Playback / Gap Warning fields (per work.md) ──
      smooth_playback_enabled: false, // Disabled per user request
      smooth_stream_url: null, // Disabled
      delay_seconds: channel.playback_delay_seconds || 300,
      buffer_ready: channel.is_buffer_ready === true,
      buffer_depth_seconds: channel.buffer_depth_seconds || 0,
      buffer_quality_status: channel.buffer_quality_status || 'clean_buffer',
      clean_buffer_percentage: channel.clean_buffer_percentage !== null && channel.clean_buffer_percentage !== undefined
        ? Number(channel.clean_buffer_percentage) : 100,
      skipped_segment_count: channel.skipped_segment_count || 0,
      missing_segment_count: channel.missing_segment_count || 0,
      gap_handling_mode: channel.gap_handling_mode || 'skip_missing_chunks',
      allow_skip_missing_segments: channel.allow_skip_missing_segments !== false,
      // gap_warning = true tells the Flutter app to show the small unstable-source overlay
      gap_warning: false,
      gap_warning_message: null,
      // Go Live — only available when there is a direct live URL and channel is not blocked
      direct_live_url: channel.stream_url || null,
      can_go_live: !!(channel.stream_url) && !channel.is_hidden && !channel.is_removed &&
        channel.is_visible_app !== false &&
        !['requires_licensed_source','drm_or_unsupported','geo_blocked','forbidden_403','offline','dead']
          .includes(channel.health_status),
    });
  } catch (err) {
    console.error('getChannelPlayback error:', err);
    error(res, 'Failed to fetch playback streams', 500);
  }
};

// reportPlaybackResult — called by Flutter player when stream plays (possibly after retry)
// POST /api/channels/:id/playback-result
// Body: { result, status, stream_url, stream_id, buffer_seconds, user_id, playback_path }
exports.reportPlaybackResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status, stream_url, stream_id, buffer_seconds, user_id, playback_path } = req.body;

    // Accepted results: 'played', 'played_after_retry', 'failed'
    const validResults = ['played', 'played_after_retry', 'failed'];
    if (!validResults.includes(result)) {
      return error(res, 'Invalid result value', 400);
    }

    const hasHealthStatus = await checkHealthStatusColumn();
    if (!hasHealthStatus) {
      return success(res, { message: 'health_status column not available' });
    }

    let newChannelStatus = null;
    let newStreamStatus = null;

    if (result === 'played') {
      newChannelStatus = 'online';
      newStreamStatus = 'online';
    } else if (result === 'played_after_retry') {
      // Played but had to retry — channel is unstable/playable, NOT offline
      newChannelStatus = 'unstable';
      newStreamStatus = 'unstable';
    } else if (result === 'failed') {
      // Caller explicitly marks it failed — do not auto-change channel status here;
      // the reportFailure endpoint handles that with smart thresholds
      newChannelStatus = null;
    }

    // ── Step 1: Update per-stream health (success improves health_score) ────
    const hasStreamsTable = await checkChannelStreamsTable();
    let resolvedStreamId = stream_id || null;

    if (hasStreamsTable && newStreamStatus) {
      // Resolve stream_id from stream_url if not provided
      if (!resolvedStreamId && stream_url) {
        const sr = await db.query(
          'SELECT id FROM channel_streams WHERE channel_id = $1 AND stream_url = $2 LIMIT 1',
          [id, stream_url]
        );
        if (sr.rows.length > 0) resolvedStreamId = sr.rows[0].id;
      }

      if (resolvedStreamId) {
        if (result === 'played') {
          // Success: recover health_score, mark online, increment success_count
          await db.query(`
            UPDATE channel_streams
            SET health_status  = 'online',
                health_score   = LEAST(100, COALESCE(health_score, 50) + 10),
                success_count  = COALESCE(success_count, 0) + 1,
                last_success_at = NOW(),
                last_checked_at = NOW()
            WHERE id = $1
          `, [resolvedStreamId]);
        } else if (result === 'played_after_retry') {
          // Unstable: partial score recovery so it stays visible but deprioritized
          await db.query(`
            UPDATE channel_streams
            SET health_status  = 'unstable',
                health_score   = LEAST(80, COALESCE(health_score, 50) + 5),
                success_count  = COALESCE(success_count, 0) + 1,
                last_success_at = NOW(),
                last_checked_at = NOW()
            WHERE id = $1
          `, [resolvedStreamId]);
        }
      } else if (stream_url) {
        // No stream_id — fall back to matching by URL
        await db.query(`
          UPDATE channel_streams
          SET health_status  = $1,
              health_score   = LEAST(100, COALESCE(health_score, 50) + 10),
              success_count  = COALESCE(success_count, 0) + 1,
              last_success_at = NOW(),
              last_checked_at = NOW()
          WHERE channel_id = $2 AND stream_url = $3
        `, [newStreamStatus, id, stream_url]);
      }
    }

    // ── Step 2: Update channel-level health ──────────────────────────────────
    if (newChannelStatus) {
      if (result === 'played') {
        // Full success: recover channel to online, reset fail_count
        await db.query(`
          UPDATE channels
          SET health_status   = 'online',
              health_score    = LEAST(100, COALESCE(health_score, 50) + 5),
              last_success_at = NOW(),
              last_checked_at = NOW(),
              fail_count      = 0
          WHERE id = $1
        `, [id]);
      } else if (result === 'played_after_retry') {
        // Unstable — do not reset fail_count, but don't escalate further
        await db.query(`
          UPDATE channels
          SET health_status   = CASE
                WHEN health_status IN ('online', 'unstable', 'needs_review', 'unknown')
                THEN 'unstable'
                ELSE health_status          -- don't downgrade from likely_broken
              END,
              health_score    = LEAST(80, COALESCE(health_score, 50) + 3),
              last_success_at = NOW(),
              last_checked_at = NOW()
          WHERE id = $1
        `, [id]);
      }
      console.log(`[reportPlaybackResult] channel=${id} result=${result} path=${playback_path || 'unknown'} → ${newChannelStatus}`);
    }

    // ── Step 3: Update watch stats + history (fire-and-forget) ──────────────
    if (result === 'played' || result === 'played_after_retry') {
      db.query(`
        UPDATE channels
        SET watch_count      = COALESCE(watch_count, 0) + 1,
            popularity_score = COALESCE(popularity_score, 0) + 3
        WHERE id = $1
      `, [id]).catch(() => {});

      const uid = user_id || req.user?.id || null;
      if (uid) {
        // Include stream_id in watch_history if migration 031 added the column
        db.query(`
          INSERT INTO watch_history (user_id, channel_id, watched_at, watch_duration, stream_id)
          VALUES ($1, $2, NOW(), $3, $4)
        `, [uid, id, parseInt(buffer_seconds) || 0, resolvedStreamId]).catch(() => {
          // Fallback: insert without stream_id (migration 031 not run yet)
          db.query(
            `INSERT INTO watch_history (user_id, channel_id, watched_at, watch_duration) VALUES ($1, $2, NOW(), $3)`,
            [uid, id, parseInt(buffer_seconds) || 0]
          ).catch(() => {});
        });
      }
    }

    success(res, { success: true, health_status: newChannelStatus });
  } catch (err) {
    console.error('reportPlaybackResult error:', err);
    error(res, 'Failed to report playback result', 500);
  }
};

exports.reportChannelDisplay = async (req, res) => {
  try {
    const { id } = req.params;
    const { aspect_ratio_type, video_width, video_height, detected_fit_mode } = req.body;

    const validRatios = ['16:9', '4:3', 'unknown', 'wide', 'vertical', 'bad_metadata', 'unusual'];
    const cleanRatio = validRatios.includes(aspect_ratio_type) ? aspect_ratio_type : null;
    const cleanNote = [
      video_width ? `w:${video_width}` : '',
      video_height ? `h:${video_height}` : '',
      detected_fit_mode ? `fit:${detected_fit_mode}` : '',
    ].filter(Boolean).join(' ') || null;

    const displayStatus = [
      cleanRatio || 'unknown',
      detected_fit_mode || 'auto',
    ].join('/');

    if (!cleanRatio && !cleanNote) {
      return error(res, 'No valid display data provided', 400);
    }

    // Only update aspect_ratio_type and fit_note, never overwrite admin-set default_fit_mode
    await db.query(
      `UPDATE channels SET
        aspect_ratio_type = COALESCE($1, aspect_ratio_type),
        fit_note = COALESCE($2, fit_note),
        player_display_status = $3,
        updated_at = NOW()
      WHERE id = $4`,
      [cleanRatio, cleanNote, displayStatus, id]
    );

    success(res, { success: true });
  } catch (err) {
    console.error('reportChannelDisplay error:', err);
    error(res, 'Failed to report display info', 500);
  }
};

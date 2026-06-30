const db = require('../config/db');
const { success, error } = require('../utils/response');

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
    healthStatusColumnExists = false;
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
    mergedIntoColumnExists = false;
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
  } catch (err) {
    channelStreamsTableExists = false;
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
    channelFailColumnsExist = false;
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

// PLAYABLE health statuses — shown when workingOnly=true
const WORKING_STATUSES = ['online', 'playable', 'stable', 'unstable'];
// Hidden health statuses — always hidden from normal users
const DEAD_STATUSES = ['offline', 'dead', 'forbidden_403', 'drm_or_unsupported', 'geo_blocked', 'requires_licensed_source'];
// Allow unknown streams (channels not yet checked) when ALLOW_UNKNOWN_STREAMS=true in .env
const ALLOW_UNKNOWN = process.env.ALLOW_UNKNOWN_STREAMS === 'true';

// Build the health_status filter fragment for workingOnly mode
function buildHealthFilter(paramIndex) {
  const statusList = WORKING_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
  const params = [...WORKING_STATUSES];
  let fragment = `c.health_status IN (${statusList})`;
  const nextIndex = paramIndex + params.length;

  if (ALLOW_UNKNOWN) {
    fragment = `(${fragment} OR c.health_status IS NULL OR c.health_status = 'unknown')`;
  }
  return { fragment, params, nextIndex };
}

// getChannels — main public API
// Supports: categoryId, language, workingOnly, search, page, limit, premium, featured, sort
exports.getChannels = async (req, res) => {
  try {
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
      sort,           // recommended | popular | premium | az | recent | quality | stable
    } = req.query;

    const usePagination = page !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    console.log('[getChannels] filters:', {
      categoryId, category, language, workingOnly, showOffline, search, premium, page: pageNum
    });

    // Always exclude merged/duplicate/inactive channels
    const conditions = [
      `c.status = 'active'`,
      `c.stream_url IS NOT NULL`,
      `c.stream_url != ''`,
    ];
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
      // Default mode: hide clearly dead channels, show unknown/unstable
      if (hasHealthStatus) {
        const deadList = DEAD_STATUSES.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`((c.health_status IS NULL OR c.health_status NOT IN (${deadList})) OR c.is_premium = true)`);
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

      return res.json({
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
          workingOnly: workingOnly === 'true',
          premium: premium || 'all',
          search: search || null,
          sort: sort || 'recommended',
        },
      });
    }

    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c ${joinClause} ${whereClause} ${orderClause}`,
      params
    );
    const formatted = result.rows.map(row => formatChannelRow(req, row));
    success(res, formatted);
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
       WHERE c.id = $1 AND c.status = 'active'`,
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
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.status = 'active'
         AND c.status NOT IN ('merged','duplicate','inactive')
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
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.category_id = $1
         AND c.status = 'active'
         AND c.status NOT IN ('merged','duplicate','inactive')
       ORDER BY c.sort_order ASC, c.name ASC`,
      [categoryId]
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
    const { workingOnly } = req.query;
    const hasHealthStatus = await checkHealthStatusColumn();

    let channelFilter = `ch.status = 'active' AND ch.stream_url IS NOT NULL AND ch.stream_url != ''`;

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
    const { workingOnly } = req.query;
    const hasHealthStatus = await checkHealthStatusColumn();

    let channelFilter = `c.status = 'active' AND c.stream_url IS NOT NULL AND c.stream_url != '' AND c.language IS NOT NULL AND c.language != ''`;
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
      channelFilter += ` AND (c.health_status IS NULL OR c.health_status NOT IN (${deadList}))`;
      params.push(...DEAD_STATUSES);
    }

    const result = await db.query(
      `SELECT
         INITCAP(LOWER(TRIM(c.language))) as name,
         COUNT(*)::int as channel_count
       FROM channels c
       WHERE ${channelFilter}
       GROUP BY LOWER(TRIM(c.language))
       HAVING COUNT(*) > 0
       ORDER BY COUNT(*) DESC, LOWER(TRIM(c.language)) ASC`,
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

      let fallbackDesc = 'Schedule information is not available.';
      if (categoryName.includes('hindi news')) {
        fallbackDesc = 'Watch live Hindi news, breaking updates, politics, business and current affairs.';
      } else if (categoryName.includes('english news')) {
        fallbackDesc = 'Watch live English news, national updates, global headlines and business coverage.';
      } else if (categoryName.includes('movies')) {
        fallbackDesc = 'Watch live Hindi movies and entertainment.';
      } else if (categoryName.includes('bengali')) {
        fallbackDesc = 'Watch live Bengali TV, news, music and entertainment.';
      } else if (categoryName.includes('sports')) {
        fallbackDesc = 'Watch live sports coverage and sports updates.';
      } else if (categoryName.includes('music')) {
        fallbackDesc = 'Watch live music, songs and entertainment.';
      } else if (categoryName.includes('doordarshan')) {
        fallbackDesc = 'Watch live Doordarshan broadcast.';
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
    let { category_id, language, name, category_name } = currentChannel;

    // Derive language from category name if not set
    if (!language || language.trim().length === 0) {
      const catName = (category_name || '').toLowerCase();
      if (catName.includes('hindi')) language = 'Hindi';
      else if (catName.includes('english')) language = 'English';
      else if (catName.includes('bengali')) language = 'Bengali';
      else if (catName.includes('tamil')) language = 'Tamil';
      else if (catName.includes('telugu')) language = 'Telugu';
      else if (catName.includes('malayalam')) language = 'Malayalam';
      else if (catName.includes('kannada')) language = 'Kannada';
      else if (catName.includes('marathi')) language = 'Marathi';
      else if (catName.includes('punjabi')) language = 'Punjabi';
      else if (catName.includes('gujarati')) language = 'Gujarati';
      else if (catName.includes('odia')) language = 'Odia';
      else if (catName.includes('assamese')) language = 'Assamese';
      else if (catName.includes('urdu')) language = 'Urdu';
      else if (catName.includes('doordarshan')) language = 'Hindi';
      else language = 'Hindi'; // Default for Indian channels
    }

    let sameCategoryChannels = [];
    let sameLanguageChannels = [];
    let fallbackChannels = [];
    const seenIds = new Set([currentChannel.id]);

    // Check if health_status column exists for filtering
    const hasHealthStatus = await checkHealthStatusColumn();
    const healthFilter = hasHealthStatus
      ? "AND (c.health_status = 'online' OR c.health_status IS NULL)"
      : '';

    // Fix #25: Run category and language queries in parallel instead of sequentially
    const baseSelect = `SELECT c.*, cat.name as category_name
       FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id != $1
       AND c.status = 'active'
       AND c.stream_url IS NOT NULL AND c.stream_url != ''`;

    const [categoryRes, langRes] = await Promise.all([
      category_id ? db.query(
        `${baseSelect} AND c.category_id = $2 ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC LIMIT 20`,
        [id, category_id]
      ) : Promise.resolve({ rows: [] }),
      (language && language.trim().length > 0) ? db.query(
        `${baseSelect} AND LOWER(c.language) = LOWER($2) ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC LIMIT 20`,
        [id, language.trim()]
      ) : Promise.resolve({ rows: [] }),
    ]);

    // 1. Same category
    for (const row of categoryRes.rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        sameCategoryChannels.push({ ...row, source_type: 'same_category' });
      }
    }

    // 2. Same language (supplement if category results are sparse)
    for (const row of langRes.rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        sameLanguageChannels.push({ ...row, source_type: 'same_language' });
        if (sameCategoryChannels.length + sameLanguageChannels.length >= 20) break;
      }
    }

    // 3. Fallback: popular/featured if still sparse
    const totalSoFar = sameCategoryChannels.length + sameLanguageChannels.length;
    if (totalSoFar < 6) {
      const fallbackRes = await db.query(
        `${baseSelect} ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC LIMIT 20`,
        [id]
      );
      for (const row of fallbackRes.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          fallbackChannels.push({ ...row, source_type: 'fallback_popular' });
          if (sameCategoryChannels.length + sameLanguageChannels.length + fallbackChannels.length >= 20) break;
        }
      }
    }

    // Combine all
    const allRelated = [...sameCategoryChannels, ...sameLanguageChannels, ...fallbackChannels];

    // Determine overall source_type for the response
    let responseSourceType = 'fallback_popular';
    if (sameCategoryChannels.length > 0) {
      responseSourceType = 'same_category';
    } else if (sameLanguageChannels.length > 0) {
      responseSourceType = 'same_language';
    }

    // Format and return
    const formatted = allRelated.slice(0, 20).map(row => formatChannelRow(req, row));

    success(res, {
      channels: formatted,
      source_type: responseSourceType,
      same_category_count: sameCategoryChannels.length,
      same_language_count: sameLanguageChannels.length,
      fallback_count: fallbackChannels.length
    });
  } catch (err) {
    console.error('getRelatedChannels error:', err);
    error(res, 'Failed to fetch related channels', 500);
  }
};

exports.reportFailure = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, stream_url, stream_id, buffer_seconds, device, player, message } = req.body;
    
    const failReason = reason || message || 'buffer_timeout';

    // Fix #26: Use cached table/column existence checks instead of per-request schema introspection
    const hasStreamsTable = await checkChannelStreamsTable();
    
    if (hasStreamsTable) {
      let targetStreamId = stream_id;
      if (!targetStreamId && stream_url) {
        const streamRes = await db.query(
          'SELECT id FROM channel_streams WHERE channel_id = $1 AND stream_url = $2',
          [id, stream_url]
        );
        if (streamRes.rows.length > 0) targetStreamId = streamRes.rows[0].id;
      }
      
      if (targetStreamId) {
        const updateRes = await db.query(`
          UPDATE channel_streams 
          SET fail_count = fail_count + 1, 
              health_score = GREATEST(0, health_score - 20),
              last_failed_at = NOW(),
              health_reason = $1
          WHERE id = $2 RETURNING fail_count, health_score
        `, [failReason, targetStreamId]);
        
        if (updateRes.rows.length > 0) {
          const { fail_count, health_score } = updateRes.rows[0];
          if (fail_count >= 2 || health_score <= 40) {
            await db.query(`UPDATE channel_streams SET health_status = 'unstable' WHERE id = $1`, [targetStreamId]);
          }
          if (fail_count >= 4 || health_score <= 0) {
            await db.query(`UPDATE channel_streams SET health_status = 'offline' WHERE id = $1`, [targetStreamId]);
          }
        }
      }
    }

    // Fix #5: Remove DDL (ALTER TABLE) from request handler — the fail_count columns are now
    // added via migration 010_add_channel_fail_columns.sql. If the column doesn't exist yet
    // (migration not run), we skip this update gracefully rather than trying to ALTER TABLE.
    // Fix #26: Use cached column check
    const hasFailColumns = await checkChannelFailColumns();
    if (hasFailColumns) {
      const updateRes = await db.query(`
        UPDATE channels 
        SET fail_count = COALESCE(fail_count, 0) + 1, 
            last_failure_at = NOW(), 
            failure_reason = $1 
        WHERE id = $2 
        RETURNING fail_count, health_status
      `, [failReason, id]);

      if (updateRes.rows.length > 0) {
        const { fail_count: failCount, health_status: currentHealth } = updateRes.rows[0];
        const hasHealthStatus = await checkHealthStatusColumn();
        if (hasHealthStatus) {
          if (failCount >= 3 && failCount < 7 && currentHealth !== 'offline') {
            // 3–6 failures → unstable (still shows in workingOnly mode)
            await db.query(`UPDATE channels SET health_status = 'unstable' WHERE id = $1 AND health_status NOT IN ('online')`, [id]);
          } else if (failCount >= 7) {
            // 7+ consecutive failures → mark offline
            await db.query(`UPDATE channels SET health_status = 'offline' WHERE id = $1`, [id]);
          }
        }
      }
    }

    success(res, { success: true, message: 'Failure reported' });
  } catch (err) {
    console.error('reportFailure error:', err);
    error(res, 'Failed to report', 500);
  }
};

exports.getChannelPlayback = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get protocol and host to build absolute proxy URLs if needed
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Fix #26: Use cached table check
    const hasStreamsTable = await checkChannelStreamsTable();

    const compileHeaders = (stream) => {
      return {
        'User-Agent': stream.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(stream.referer ? { 'Referer': stream.referer } : {}),
        ...(stream.origin ? { 'Origin': stream.origin } : {}),
        ...(stream.headers_json ? stream.headers_json : {})
      };
    };

    const getPlayUrl = (stream) => {
      if (stream.playback_mode === 'proxy') {
        return `${baseUrl}/api/proxy/${stream.id}/master.m3u8`;
      }
      return stream.final_url || stream.stream_url;
    };

    if (!hasStreamsTable) {
      const result = await db.query('SELECT name, stream_url, backup_stream_url, user_agent, referrer FROM channels WHERE id = $1', [id]);
      if (result.rows.length === 0) return error(res, 'Channel not found', 404);
      const row = result.rows[0];
      
      const defaultHeaders = {
        'User-Agent': row.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(row.referrer ? { 'Referer': row.referrer } : {})
      };

      return success(res, {
        channel_id: parseInt(id),
        channel: { id: parseInt(id), name: row.name || 'Unknown Channel' },
        qualities: [{
          label: "Auto",
          url: row.stream_url,
          type: "auto",
          headers: defaultHeaders
        }],
        primary_stream: { url: row.stream_url, quality: 'auto', headers: defaultHeaders, playback_mode: 'direct' },
        backup_streams: row.backup_stream_url ? [{ url: row.backup_stream_url, quality: 'auto', headers: defaultHeaders }] : []
      });
    }

    let result = await db.query(`
      SELECT * FROM channel_streams 
      WHERE channel_id = $1 AND health_status != 'offline'
      ORDER BY 
        priority ASC, 
        CASE health_status 
          WHEN 'online' THEN 3 
          WHEN 'unstable' THEN 2 
          WHEN 'unknown' THEN 1 
          ELSE 0 
        END DESC,
        health_score DESC
    `, [id]);

    if (result.rows.length === 0) {
      result = await db.query('SELECT * FROM channel_streams WHERE channel_id = $1 ORDER BY priority ASC', [id]);
      if (result.rows.length === 0) {
        return error(res, 'No streams available for this channel', 404);
      }
    }

    let primary = result.rows.find(r => r.parent_stream_id == null);
    if (!primary) primary = result.rows[0];

    const variantRows = result.rows.filter(r => r.parent_stream_id === primary.id);
    
    let qualities = [{
      label: "Auto",
      url: getPlayUrl(primary),
      type: "auto",
      headers: compileHeaders(primary)
    }];

    for (const v of variantRows) {
      qualities.push({
        label: v.quality_label || 'Original',
        url: getPlayUrl(v),
        height: v.resolution_height,
        bitrate: v.bitrate,
        headers: compileHeaders(v)
      });
    }

    // Sort qualities: Auto first, then descending by height
    qualities.sort((a, b) => {
      if (a.type === 'auto') return -1;
      if (b.type === 'auto') return 1;
      return (b.height || 0) - (a.height || 0);
    });

    const backups = result.rows.filter(r => r.id !== primary.id && r.parent_stream_id == null).map(r => ({
      id: r.id,
      url: getPlayUrl(r),
      quality: r.quality,
      headers: compileHeaders(r)
    }));

    const channelRes = await db.query('SELECT name FROM channels WHERE id = $1', [id]);
    const channelName = channelRes.rows[0]?.name || 'Unknown Channel';

    success(res, {
      channel_id: parseInt(id),
      channel: { id: parseInt(id), name: channelName },
      qualities: qualities,
      primary_stream: {
        id: primary.id,
        url: getPlayUrl(primary),
        final_url: primary.final_url || primary.stream_url,
        quality: primary.quality,
        headers: compileHeaders(primary),
        playback_mode: primary.playback_mode || 'direct'
      },
      backup_streams: backups
    });
  } catch (err) {
    console.error('getChannelPlayback error:', err);
    error(res, 'Failed to fetch playback streams', 500);
  }
};

// reportPlaybackResult — called by Flutter player when a stream plays (possibly after retry)
// POST /api/channels/:id/playback-result  { result, status, stream_url, buffer_seconds, user_id }
exports.reportPlaybackResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status, stream_url, buffer_seconds, user_id } = req.body;

    // Accepted results: 'played', 'played_after_retry', 'failed'
    const validResults = ['played', 'played_after_retry', 'failed'];
    if (!validResults.includes(result)) {
      return error(res, 'Invalid result value', 400);
    }

    const hasHealthStatus = await checkHealthStatusColumn();
    if (!hasHealthStatus) {
      return success(res, { message: 'health_status column not available' });
    }

    let newHealthStatus = null;

    if (result === 'played') {
      newHealthStatus = 'online';
    } else if (result === 'played_after_retry') {
      // Buffers but eventually plays — mark unstable, not offline
      newHealthStatus = 'unstable';
    } else if (result === 'failed') {
      // Only mark offline via this route if status explicitly says so
      if (status === 'offline' || status === 'dead') {
        newHealthStatus = 'offline';
      }
    }

    if (newHealthStatus) {
      await db.query(
        `UPDATE channels SET health_status = $1, last_checked_at = NOW() WHERE id = $2`,
        [newHealthStatus, id]
      );

      // Also update channel_streams if url provided
      const hasStreamsTable = await checkChannelStreamsTable();
      if (hasStreamsTable && stream_url) {
        if (result === 'played') {
          // DB-06 FIX: Increment health_score on success so streams can recover from
          // a previously unstable state instead of staying deprioritized forever.
          await db.query(
            `UPDATE channel_streams
             SET health_status = $1,
                 health_score = LEAST(100, health_score + 10),
                 success_count = success_count + 1,
                 last_success_at = NOW(),
                 last_checked_at = NOW()
             WHERE channel_id = $2 AND stream_url = $3`,
            [newHealthStatus, id, stream_url]
          );
        } else {
          await db.query(
            `UPDATE channel_streams SET health_status = $1, last_checked_at = NOW()
             WHERE channel_id = $2 AND stream_url = $3`,
            [newHealthStatus, id, stream_url]
          );
        }
      }

      console.log(`[reportPlaybackResult] channel=${id} result=${result} → health_status=${newHealthStatus}`);
    }

    // If play was successful, update watch_count and record watch history
    if (result === 'played' || result === 'played_after_retry') {
      // Increment watch_count and update popularity_score (fire-and-forget)
      db.query(
        `UPDATE channels SET
           watch_count = COALESCE(watch_count, 0) + 1,
           popularity_score = COALESCE(popularity_score, 0) + 3
         WHERE id = $1`,
        [id]
      ).catch(() => {});

      // Record in watch_history if user is identified (user_id from request body)
      const uid = user_id || req.user?.id || null;
      if (uid) {
        db.query(
          `INSERT INTO watch_history (user_id, channel_id, watched_at, watch_duration)
           VALUES ($1, $2, NOW(), $3)`,
          [uid, id, buffer_seconds || 0]
        ).catch(() => {});
      }
    }

    success(res, { success: true, health_status: newHealthStatus });
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

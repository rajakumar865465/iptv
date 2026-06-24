const db = require('../config/db');
const { success, error } = require('../utils/response');

let healthStatusColumnExists = null;

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

// getChannels, getChannel, searchChannels have been preserved from the current structure.
// They already include the 'active' status check.
exports.getChannels = async (req, res) => {
  try {
    const { category, search, featured, popular, page, limit } = req.query;
    const usePagination = page !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const conditions = [`c.status = 'active'`];
    const params = [];
    let paramIndex = 1;

    // For paginated requests, also filter out channels without valid stream URLs
    if (usePagination) {
      conditions.push(`c.stream_url IS NOT NULL AND c.stream_url != ''`);
    }

    if (category) {
      conditions.push(`cat.name ILIKE $${paramIndex++}`);
      params.push(`%${category}%`);
    }

    if (featured === 'true' || popular === 'true') {
      conditions.push(`c.is_featured = true`);
    }

    if (search) {
      conditions.push(`(c.name ILIKE $${paramIndex} OR c.language ILIKE $${paramIndex} OR cat.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const joinClause = `LEFT JOIN categories cat ON c.category_id = cat.id`;
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderClause = `ORDER BY c.sort_order ASC, c.name ASC`;

    if (usePagination) {
      const offset = (pageNum - 1) * limitNum;

      const countResult = await db.query(
        `SELECT COUNT(*) FROM channels c ${joinClause} ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `SELECT c.*, cat.name as category_name FROM channels c ${joinClause} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limitNum, offset]
      );

      const formatted = dataResult.rows.map(row => formatChannelRow(req, row));
      return res.json({
        success: true,
        data: formatted,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: offset + dataResult.rows.length < total
        }
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
       AND (c.name ILIKE $1 OR cat.name ILIKE $1 OR c.language ILIKE $1)
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
       WHERE c.category_id = $1 AND c.status = 'active'
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
    const result = await db.query(
      `SELECT c.*, COUNT(ch.id) as channel_count
       FROM categories c
       LEFT JOIN channels ch ON c.id = ch.category_id AND ch.status = 'active'
       WHERE c.status = 'active'
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    success(res, result.rows);
  } catch (err) {
    console.error('getCategories error:', err);
    error(res, 'Failed to fetch categories', 500);
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

    // 1. Same category first
    if (category_id) {
      const categoryRes = await db.query(
        `SELECT c.*, cat.name as category_name
         FROM channels c
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id != $1
         AND c.status = 'active'
         AND c.stream_url IS NOT NULL AND c.stream_url != ''
         AND c.category_id = $2
         ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC
         LIMIT 20`,
        [id, category_id]
      );
      for (const row of categoryRes.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          sameCategoryChannels.push({ ...row, source_type: 'same_category' });
        }
      }
    }

    // 2. Fallback: If same category has less than 6 channels, add same language channels
    if (sameCategoryChannels.length < 6 && language && language.trim().length > 0) {
      const langRes = await db.query(
        `SELECT c.*, cat.name as category_name
         FROM channels c
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id != $1
         AND c.status = 'active'
         AND c.stream_url IS NOT NULL AND c.stream_url != ''
         AND LOWER(c.language) = LOWER($2)
         ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC
         LIMIT 20`,
        [id, language.trim()]
      );
      for (const row of langRes.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          sameLanguageChannels.push({ ...row, source_type: 'same_language' });
          if (sameCategoryChannels.length + sameLanguageChannels.length >= 20) break;
        }
      }
    }

    // 3. Fallback: If still less than 6, add popular/featured active channels
    const totalSoFar = sameCategoryChannels.length + sameLanguageChannels.length;
    if (totalSoFar < 6) {
      const fallbackRes = await db.query(
        `SELECT c.*, cat.name as category_name
         FROM channels c
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id != $1
         AND c.status = 'active'
         AND c.stream_url IS NOT NULL AND c.stream_url != ''
         ${healthFilter}
         ORDER BY c.is_featured DESC, c.sort_order ASC, c.name ASC
         LIMIT 20`,
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

    // Debug logging
    console.log('[getRelatedChannels] Debug:', {
      current_channel_id: currentChannel.id,
      current_channel_name: name,
      category_id: category_id,
      category_name: category_name,
      language: language,
      same_category_count: sameCategoryChannels.length,
      same_language_count: sameLanguageChannels.length,
      fallback_count: fallbackChannels.length,
      total_returned: allRelated.length,
      response_source_type: responseSourceType,
      first_5_channels: allRelated.slice(0, 5).map(c => ({ id: c.id, name: c.name, category: c.category_name, source_type: c.source_type }))
    });

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
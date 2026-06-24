const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getChannels = async (req, res) => {
  try {
    const { category, search, featured, popular } = req.query;
    let query = `
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status = 'active'
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND cat.name ILIKE $${paramIndex++}`;
      params.push(`%${category}%`);
    }

    if (featured === 'true') {
      query += ` AND c.is_featured = true`;
    }

    if (popular === 'true') {
      query += ` AND c.is_featured = true`;
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.language ILIKE $${paramIndex} OR cat.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.sort_order ASC, c.name ASC`;

    const result = await db.query(query, params);
    success(res, result.rows);
  } catch (err) {
    console.error('getChannels error:', err);
    error(res, 'Failed to fetch channels', 500);
  }
};

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
    success(res, result.rows[0]);
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
    success(res, result.rows);
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
    success(res, result.rows);
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

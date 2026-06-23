const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getChannels = async (req, res) => {
  try {
    const { category_id, featured, search } = req.query;
    let query = `
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status NOT IN ('hidden', 'disabled')
    `;
    const params = [];
    let paramIndex = 1;

    if (category_id) {
      query += ` AND c.category_id = $${paramIndex++}`;
      params.push(category_id);
    }

    if (featured === 'true') {
      query += ` AND c.is_featured = true`;
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.language ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.sort_order ASC, c.name ASC`;

    const result = await db.query(query, params);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch channels', 500);
  }
};

exports.getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1 AND c.status NOT IN ('hidden', 'disabled')`,
      [id]
    );
    if (result.rows.length === 0) {
      return error(res, 'Channel not found', 404);
    }
    success(res, result.rows[0]);
  } catch (err) {
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
       WHERE c.status NOT IN ('hidden', 'disabled')
       AND (c.name ILIKE $1 OR cat.name ILIKE $1 OR c.language ILIKE $1)
       ORDER BY c.name ASC`,
      [`%${q}%`]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to search channels', 500);
  }
};

exports.getChannelsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await db.query(
      `SELECT c.*, cat.name as category_name FROM channels c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.category_id = $1 AND c.status NOT IN ('hidden', 'disabled')
       ORDER BY c.sort_order ASC, c.name ASC`,
      [categoryId]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch channels by category', 500);
  }
};

exports.getCategories = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM categories WHERE status = $1 ORDER BY sort_order ASC',
      ['active']
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch categories', 500);
  }
};

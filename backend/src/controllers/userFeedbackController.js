const db = require('../config/db');
const { success, error } = require('../utils/response');

const VALID_CATEGORIES = ['App Crash', 'Playback Issue', 'Login Issue', 'Payment Issue', 'Other'];

// POST /api/user/feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { category, description, device_info, app_version, platform } = req.body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return error(res, `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }
    if (!description || description.trim().length < 10) {
      return error(res, 'Description must be at least 10 characters', 400);
    }
    if (description.length > 2000) {
      return error(res, 'Description must be 2000 characters or less', 400);
    }

    const result = await db.query(
      `INSERT INTO user_feedback (user_id, category, description, device_info, app_version, platform)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id, created_at`,
      [
        req.user.id,
        category,
        description.trim(),
        device_info ? JSON.stringify(device_info) : null,
        app_version || null,
        platform || null,
      ]
    );
    return success(res, result.rows[0], 'Feedback submitted successfully', 201);
  } catch (err) {
    console.error('submitFeedback error:', err.message);
    return error(res, 'Failed to submit feedback', 500);
  }
};

// GET /api/internal/feedback  (admin)
exports.getFeedback = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];
    let pi = 1;

    if (status) { conditions.push(`f.status = $${pi++}`); params.push(status); }
    if (category) { conditions.push(`f.category = $${pi++}`); params.push(category); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(
      `SELECT f.id, f.category, f.description, f.device_info, f.app_version,
              f.platform, f.status, f.admin_note, f.created_at,
              u.full_name, u.email, u.mobile
       FROM user_feedback f
       LEFT JOIN users u ON f.user_id = u.id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      [...params, parseInt(limit), offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM user_feedback f ${where}`,
      params
    );

    return success(res, {
      items: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('getFeedback error:', err.message);
    return error(res, 'Failed to fetch feedback', 500);
  }
};

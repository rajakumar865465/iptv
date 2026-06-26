const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getPlans = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const countResult = await db.query('SELECT COUNT(*) FROM plans');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      'SELECT * FROM plans ORDER BY sort_order ASC, created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch plans', 500);
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, price, duration_days, max_devices, description, is_visible, sort_order } = req.body;
    const result = await db.query(
      'INSERT INTO plans (name, price, duration_days, max_devices, description, is_visible, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, price, duration_days, max_devices, description, is_visible || false, sort_order || 0]
    );
    success(res, result.rows[0], 'Plan created', 201);
  } catch (err) {
    error(res, 'Failed to create plan', 500);
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, duration_days, max_devices, description, status, is_visible, sort_order } = req.body;
    const result = await db.query(
      'UPDATE plans SET name = $1, price = $2, duration_days = $3, max_devices = $4, description = $5, status = $6, is_visible = $7, sort_order = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
      [name, price, duration_days, max_devices, description, status, is_visible, sort_order, id]
    );
    success(res, result.rows[0], 'Plan updated');
  } catch (err) {
    error(res, 'Failed to update plan', 500);
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM plans WHERE id = $1', [id]);
    success(res, null, 'Plan deleted');
  } catch (err) {
    error(res, 'Failed to delete plan', 500);
  }
};

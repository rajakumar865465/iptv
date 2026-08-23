const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getPlans = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const countResult = await db.query("SELECT COUNT(*) FROM plans WHERE status != 'deleted' OR status IS NULL");
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      "SELECT * FROM plans WHERE status != 'deleted' OR status IS NULL ORDER BY sort_order ASC, created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    success(res, { data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    error(res, 'Failed to fetch plans', 500);
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, price, duration_days, max_devices, description, is_visible, status, sort_order } = req.body;
    if (!name || price === undefined || !duration_days) {
      return error(res, 'name, price and duration_days are required', 400);
    }
    const result = await db.query(
      'INSERT INTO plans (name, price, duration_days, max_devices, description, is_visible, status, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, price, duration_days, max_devices || 1, description || '', is_visible !== false, status || 'active', sort_order || 0]
    );
    success(res, result.rows[0], 'Plan created', 201);
  } catch (err) {
    console.error('createPlan error:', err);
    error(res, 'Failed to create plan: ' + err.message, 500);
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
    
    // Check if plan has active dependencies
    const licenses = await db.query('SELECT id FROM licenses WHERE plan_id = $1 LIMIT 1', [id]);
    const orders = await db.query('SELECT order_id FROM public_orders WHERE plan_id = $1 LIMIT 1', [id]);
    const manualOrders = await db.query('SELECT order_id FROM manual_orders WHERE plan_id = $1 LIMIT 1', [id]);
    
    if (licenses.rowCount > 0 || orders.rowCount > 0 || manualOrders.rowCount > 0) {
      // Soft delete if referenced
      await db.query("UPDATE plans SET status = 'deleted', is_visible = false, updated_at = NOW() WHERE id = $1", [id]);
    } else {
      // Safe to hard delete
      await db.query('DELETE FROM plans WHERE id = $1', [id]);
    }
    
    success(res, null, 'Plan deleted');
  } catch (err) {
    console.error('Delete Plan Error:', err);
    error(res, 'Failed to delete plan', 500);
  }
};

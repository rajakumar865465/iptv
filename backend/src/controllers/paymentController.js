const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getPlans = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM plans WHERE status = $1 AND is_visible = true ORDER BY duration_days ASC',
      ['active']
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch plans', 500);
  }
};

exports.getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT p.*, pl.name as plan_name FROM payments p
       LEFT JOIN plans pl ON p.plan_id = pl.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 1`,
      [userId]
    );
    success(res, result.rows[0] || null);
  } catch (err) {
    error(res, 'Failed to fetch payment status', 500);
  }
};

exports.manualRequest = async (req, res) => {
  try {
    const { plan_id, amount, payment_method } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `INSERT INTO payments (user_id, plan_id, amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [userId, plan_id, amount, payment_method || 'manual']
    );

    success(res, result.rows[0], 'Payment request submitted', 201);
  } catch (err) {
    error(res, 'Failed to submit payment request', 500);
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT p.*, pl.name as plan_name FROM payments p
       LEFT JOIN plans pl ON p.plan_id = pl.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
      [userId]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch payment history', 500);
  }
};

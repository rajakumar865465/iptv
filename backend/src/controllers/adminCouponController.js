'use strict';
/**
 * adminCouponController.js
 * Admin API for managing promotional coupons and discounts.
 */

const db = require('../config/db');
const { success, error } = require('../utils/response');

// GET /api/admin/coupons
exports.getCoupons = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT c.*, p.name AS plan_name,
        (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) AS actual_redemptions
      FROM coupons c
      LEFT JOIN plans p ON c.plan_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim().toUpperCase()}%`);
      query += ` AND (UPPER(c.code) LIKE $${params.length} OR c.description ILIKE $${params.length})`;
    }

    if (status === 'active') {
      query += ` AND c.is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND c.is_active = false`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await db.query(query, params);
    return success(res, result.rows, 'Coupons fetched successfully');
  } catch (err) {
    console.error('[admin.getCoupons] error:', err);
    return error(res, 'Failed to fetch coupons', 500);
  }
};

// POST /api/admin/coupons
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount_amount,
      plan_id,
      max_uses,
      starts_at,
      expires_at,
      is_active,
    } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return error(res, 'Coupon code is required', 400);
    }

    const cleanCode = code.trim().toUpperCase();

    if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
      return error(res, 'discount_type must be "percentage" or "fixed"', 400);
    }

    const val = Number(discount_value);
    if (isNaN(val) || val <= 0) {
      return error(res, 'discount_value must be greater than 0', 400);
    }

    if (discount_type === 'percentage' && val > 100) {
      return error(res, 'Percentage discount cannot exceed 100%', 400);
    }

    // Check duplicate code
    const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = $1', [cleanCode]);
    if (existing.rows.length > 0) {
      return error(res, `Coupon code "${cleanCode}" already exists.`, 400);
    }

    const result = await db.query(
      `INSERT INTO coupons (
        code, description, discount_type, discount_value, min_order_amount,
        max_discount_amount, plan_id, max_uses, starts_at, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        cleanCode,
        description || null,
        discount_type,
        val,
        min_order_amount ? Number(min_order_amount) : 0,
        max_discount_amount ? Number(max_discount_amount) : null,
        plan_id ? parseInt(plan_id, 10) : null,
        max_uses ? parseInt(max_uses, 10) : null,
        starts_at ? new Date(starts_at) : new Date(),
        expires_at ? new Date(expires_at) : null,
        is_active !== undefined ? !!is_active : true,
      ]
    );

    return success(res, result.rows[0], 'Coupon created successfully', 201);
  } catch (err) {
    console.error('[admin.createCoupon] error:', err);
    return error(res, 'Failed to create coupon', 500);
  }
};

// PUT /api/admin/coupons/:id
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount_amount,
      plan_id,
      max_uses,
      starts_at,
      expires_at,
      is_active,
    } = req.body;

    const check = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return error(res, 'Coupon not found', 404);
    }

    const current = check.rows[0];

    const type = discount_type || current.discount_type;
    const val = discount_value !== undefined ? Number(discount_value) : Number(current.discount_value);

    if (type === 'percentage' && val > 100) {
      return error(res, 'Percentage discount cannot exceed 100%', 400);
    }

    const result = await db.query(
      `UPDATE coupons SET
        description = $1,
        discount_type = $2,
        discount_value = $3,
        min_order_amount = $4,
        max_discount_amount = $5,
        plan_id = $6,
        max_uses = $7,
        starts_at = $8,
        expires_at = $9,
        is_active = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *`,
      [
        description !== undefined ? description : current.description,
        type,
        val,
        min_order_amount !== undefined ? Number(min_order_amount) : current.min_order_amount,
        max_discount_amount !== undefined ? (max_discount_amount ? Number(max_discount_amount) : null) : current.max_discount_amount,
        plan_id !== undefined ? (plan_id ? parseInt(plan_id, 10) : null) : current.plan_id,
        max_uses !== undefined ? (max_uses ? parseInt(max_uses, 10) : null) : current.max_uses,
        starts_at ? new Date(starts_at) : current.starts_at,
        expires_at !== undefined ? (expires_at ? new Date(expires_at) : null) : current.expires_at,
        is_active !== undefined ? !!is_active : current.is_active,
        id,
      ]
    );

    return success(res, result.rows[0], 'Coupon updated successfully');
  } catch (err) {
    console.error('[admin.updateCoupon] error:', err);
    return error(res, 'Failed to update coupon', 500);
  }
};

// DELETE /api/admin/coupons/:id
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM coupons WHERE id = $1 RETURNING id, code', [id]);
    if (result.rows.length === 0) {
      return error(res, 'Coupon not found', 404);
    }
    return success(res, result.rows[0], 'Coupon deleted successfully');
  } catch (err) {
    console.error('[admin.deleteCoupon] error:', err);
    return error(res, 'Failed to delete coupon', 500);
  }
};

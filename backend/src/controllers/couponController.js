'use strict';
/**
 * couponController.js
 * Public API for coupon code validation and discount calculation.
 */

const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.validateCoupon = async (req, res) => {
  try {
    const { code, plan_id, offer_price } = req.body;

    if (!code || typeof code !== 'string') {
      return error(res, 'Coupon code is required', 400);
    }

    if (!plan_id) {
      return error(res, 'plan_id is required to calculate discount', 400);
    }

    // 1. Fetch Plan to know original price
    const planRes = await db.query('SELECT id, name, price, plan_tier FROM plans WHERE id = $1', [plan_id]);
    if (planRes.rows.length === 0) {
      return error(res, 'Invalid plan selected', 404);
    }
    const plan = planRes.rows[0];
    const basePrice = offer_price !== undefined && offer_price !== null ? Number(offer_price) : Number(plan.price);

    // 2. Fetch Coupon
    const cleanCode = code.trim().toUpperCase();
    const couponRes = await db.query(
      `SELECT * FROM coupons 
       WHERE UPPER(code) = $1`,
      [cleanCode]
    );

    if (couponRes.rows.length === 0) {
      return error(res, 'Invalid coupon code. Please check and try again.', 404);
    }

    const coupon = couponRes.rows[0];

    // Check active
    if (!coupon.is_active) {
      return error(res, 'This coupon is no longer active.', 400);
    }

    // Check date range
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return error(res, 'This coupon promotion has not started yet.', 400);
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return error(res, 'This coupon code has expired.', 400);
    }

    // Check usage limits
    if (coupon.max_uses !== null && coupon.max_uses !== undefined && coupon.used_count >= coupon.max_uses) {
      return error(res, 'This coupon has reached its maximum usage limit.', 400);
    }

    // Check plan restriction
    if (coupon.plan_id && coupon.plan_id !== Number(plan_id)) {
      return error(res, 'This coupon is not valid for the selected plan.', 400);
    }

    // Check minimum order amount
    const minOrder = Number(coupon.min_order_amount || 0);
    if (basePrice < minOrder) {
      return error(res, `This coupon requires a minimum purchase of ₹${Math.round(minOrder)}.`, 400);
    }

    // Calculate discount
    let discountAmount = 0;
    const discountVal = Number(coupon.discount_value);

    if (coupon.discount_type === 'percentage') {
      discountAmount = (basePrice * discountVal) / 100;
      if (coupon.max_discount_amount && Number(coupon.max_discount_amount) > 0) {
        discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
      }
    } else {
      // Fixed discount
      discountAmount = Math.min(basePrice, discountVal);
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

    return success(res, {
      valid: true,
      coupon_id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: discountVal,
      original_amount: basePrice,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      formatted_discount: coupon.discount_type === 'percentage' ? `${discountVal}% OFF` : `₹${discountVal} OFF`,
    }, 'Coupon applied successfully');

  } catch (err) {
    console.error('[validateCoupon] error:', err);
    return error(res, 'Failed to validate coupon code', 500);
  }
};

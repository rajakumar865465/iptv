// Fix #16: Dedicated admin auth middleware that verifies tokens signed with ADMIN_JWT_SECRET.
// The standard auth.js uses JWT_SECRET (for regular users).
// Admin tokens are signed with ADMIN_JWT_SECRET via generateAdminToken(),
// so they will FAIL verifyToken(). This middleware uses verifyAdminToken() instead.

const { verifyAdminToken } = require('../utils/jwt');
const db = require('../config/db');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAdminToken(token);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
    }

    // Verify admin user still exists and has admin role
    const result = await db.query(
      'SELECT id, full_name, email, status, role FROM users WHERE id = $1 AND role = $2',
      [decoded.userId, 'admin']
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const admin = result.rows[0];
    if (admin.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account has been blocked.' });
    }

    req.user = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

module.exports = adminAuthMiddleware;

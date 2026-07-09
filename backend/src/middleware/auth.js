const { verifyToken } = require('../utils/jwt');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyToken(token);

    // Check if user still exists and is active
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];
    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * optionalAuth — like authMiddleware but does NOT reject unauthenticated requests.
 * Sets req.user if a valid token is present, otherwise leaves req.user as undefined.
 * Used for endpoints that work for both logged-in and anonymous users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else {
      return next(); // No token — anonymous request, continue
    }
    const decoded = verifyToken(token);
    const result = await db.query(
      'SELECT id, full_name, email, mobile, status, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (result.rows.length > 0 && result.rows[0].status !== 'blocked') {
      req.user = result.rows[0];
    }
  } catch (_) {
    // Invalid token — treat as anonymous
  }
  next();
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;

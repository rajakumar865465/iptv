const jwt = require('jsonwebtoken');

// Fail fast in production if secrets are missing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable must be set in production');
  if (!process.env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production';
// Separate secret for refresh tokens so access/refresh tokens can't be used interchangeably
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET || JWT_SECRET + '-refresh';

// Access token: short-lived (15 min)
const generateToken = (payload, expiresIn = '15m') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Refresh token: long-lived JWT (30 days) with userId embedded.
// Using a signed JWT instead of an opaque string means:
//  1. No in-memory/Redis store needed for basic validation
//  2. userId is extracted from the token server-side — clients cannot forge a different userId
//  3. Survives server restarts
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '30d' });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Verify refresh token and return userId embedded in it.
// Throws if token is invalid, expired, or wrong type.
const verifyRefreshToken = (refreshToken) => {
  const payload = jwt.verify(refreshToken, REFRESH_SECRET);
  if (payload.type !== 'refresh') throw new Error('Not a refresh token');
  return payload;
};

// Consume (verify + rotate) a refresh token.
// Returns { userId, newRefreshToken } — caller uses userId to look up the user.
const consumeRefreshToken = (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken);
  const newRefreshToken = generateRefreshToken(payload.userId);
  return { userId: payload.userId, newRefreshToken };
};

// Revoke is a no-op for JWT-based refresh tokens without a blocklist.
// To add revocation: store a jti (JWT ID) in each token and check against a DB/Redis blocklist.
const revokeRefreshToken = (_refreshToken) => {
  // TODO: add jti to token payload and store revoked jti list in DB/Redis for proper revocation
};

const generateAdminToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn });
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, ADMIN_JWT_SECRET);
};

module.exports = {
  generateToken, verifyToken,
  generateRefreshToken, verifyRefreshToken, revokeRefreshToken, consumeRefreshToken,
  generateAdminToken, verifyAdminToken,
};

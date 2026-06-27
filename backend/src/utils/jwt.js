const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Refresh token storage (in production, use Redis or database)
const refreshTokens = new Set();

// Fix #15: Fail fast in production if secrets are missing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable must be set in production');
  if (!process.env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production';

// Access token: short-lived (15 min)
const generateToken = (payload, expiresIn = '15m') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Refresh token: long-lived (30 days), opaque string
const generateRefreshToken = (userId) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  refreshTokens.add(refreshToken);
  // Store mapping: refreshToken -> userId (for revocation)
  // In production, store in Redis with TTL
  return refreshToken;
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const verifyRefreshToken = (refreshToken) => {
  if (!refreshTokens.has(refreshToken)) {
    throw new Error('Invalid refresh token');
  }
  return true;
};

const revokeRefreshToken = (refreshToken) => {
  refreshTokens.delete(refreshToken);
};

const consumeRefreshToken = (refreshToken) => {
  if (!refreshTokens.has(refreshToken)) {
    throw new Error('Invalid refresh token');
  }
  refreshTokens.delete(refreshToken);
  return generateRefreshToken(); // Return new refresh token (rotation)
};

const generateAdminToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn });
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, ADMIN_JWT_SECRET);
};

module.exports = { 
  generateToken, verifyToken, generateRefreshToken, verifyRefreshToken, 
  revokeRefreshToken, consumeRefreshToken,
  generateAdminToken, verifyAdminToken 
};

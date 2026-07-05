const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Fail fast in production if secrets are missing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable must be set in production');
  if (!process.env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production';
// Separate secret for refresh tokens so access/refresh tokens can't be used interchangeably
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET || JWT_SECRET + '-refresh';
// Secret for short-lived smooth-playback stream tokens (kept separate from auth tokens)
const SMOOTH_SECRET = process.env.SMOOTH_JWT_SECRET || JWT_SECRET + '-smooth';

// Access token: short-lived (15 min)
const generateToken = (payload, expiresIn = '15m') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Refresh token: long-lived JWT (30 days) with userId and unique jti embedded.
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: 'refresh', jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: '30d' });
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

// Revoke a refresh token by storing its jti in the database blocklist.
// Access tokens remain valid until expiry (short-lived), but refresh is blocked.
const db = require('../config/db');

const revokeRefreshToken = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    if (payload.type !== 'refresh') return;
    const jti = payload.jti || payload.iat;
    if (!jti) return;
    await db.query(
      `INSERT INTO revoked_refresh_tokens (jti, expires_at) VALUES ($1, TO_TIMESTAMP($2))
       ON CONFLICT (jti) DO NOTHING`,
      [String(jti), payload.exp || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60]
    );
  } catch (err) {
    // Invalid token — nothing to revoke
  }
};

const isRefreshTokenRevoked = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    if (payload.type !== 'refresh') return true;
    const jti = payload.jti || payload.iat;
    if (!jti) return true;
    const result = await db.query(
      'SELECT 1 FROM revoked_refresh_tokens WHERE jti = $1',
      [String(jti)]
    );
    return result.rows.length > 0;
  } catch (err) {
    return true;
  }
};

// Short-lived signed token appended to delayed_stream_url so media players can
// access the unauthenticated-by-header HLS endpoints without exposing streams.
const generateSmoothToken = (channelId, userId = null, expiresIn = '2h') => {
  return jwt.sign({ channelId: Number(channelId), userId: userId || undefined, type: 'smooth' }, SMOOTH_SECRET, { expiresIn });
};

const verifySmoothToken = (token, channelId) => {
  const payload = jwt.verify(token, SMOOTH_SECRET);
  if (payload.type !== 'smooth') throw new Error('Not a smooth token');
  if (channelId && payload.channelId !== Number(channelId)) throw new Error('Token channel mismatch');
  return payload;
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
  generateSmoothToken, verifySmoothToken,
  isRefreshTokenRevoked,
};

const jwt = require('jsonwebtoken');

// Fix #15: Fail fast in production if secrets are missing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable must be set in production');
  if (!process.env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production';

const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const generateAdminToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn });
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, ADMIN_JWT_SECRET);
};

module.exports = { generateToken, verifyToken, generateAdminToken, verifyAdminToken };

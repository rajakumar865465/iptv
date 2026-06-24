const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production';

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

const jwt = require('jsonwebtoken');

const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const generateAdminToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, { expiresIn });
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET);
};

module.exports = { generateToken, verifyToken, generateAdminToken, verifyAdminToken };

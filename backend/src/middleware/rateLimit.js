const rateLimit = require('express-rate-limit');

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000,  // Restored to 3000 - admin polling triggers 429s otherwise
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,  // Restored to 5000 
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'API rate limit exceeded. Please try again later.' });
  },
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,  // Restored to 1000
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many search requests. Please slow down.' });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,  // Reduced from 100 - still generous for auth attempts
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many auth attempts, please try again later.' });
  },
});

module.exports = { standardLimiter, apiLimiter, searchLimiter, authLimiter };

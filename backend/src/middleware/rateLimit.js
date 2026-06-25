const rateLimit = require('express-rate-limit');

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'API rate limit exceeded. Please try again later.' });
  },
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many search requests. Please slow down.' });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many auth attempts, please try again later.' });
  },
});

module.exports = { standardLimiter, apiLimiter, searchLimiter, authLimiter };

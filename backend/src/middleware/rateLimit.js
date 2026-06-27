const rateLimit = require('express-rate-limit');

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,  // Reduced from 3000 - 10 req/min is sufficient for normal usage
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,  // Reduced from 5000 - more appropriate for mobile IPTV usage
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'API rate limit exceeded. Please try again later.' });
  },
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,  // Reduced from 1000 - ample for search functionality
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

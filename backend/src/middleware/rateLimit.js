const rateLimit = require('express-rate-limit');

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many auth attempts, please try again later.' });
  },
});

module.exports = { standardLimiter, authLimiter };

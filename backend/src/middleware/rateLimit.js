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

// Token refresh happens automatically in the background (Dio interceptor on 401s),
// so it needs a much higher ceiling than interactive login/signup attempts.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many token refresh attempts, please try again later.' });
  },
});

// Anonymous channel-health telemetry (report-failure / playback-result / display-report)
// can flip a channel's health_status via repeated POSTs from a single actor.
// optionalAuth still runs first so logged-in users are identified, but since the
// mobile app also sends these reports for users who aren't logged in yet, we
// can't require auth outright — instead cap reports per channel per IP tightly,
// well below the fail-count thresholds used to escalate health_status.
const channelReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reports per channel per IP per hour
  keyGenerator: (req) => `${req.ip}:${req.params.id}`,
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many reports for this channel. Please try again later.' });
  },
});

module.exports = { standardLimiter, apiLimiter, searchLimiter, authLimiter, refreshLimiter, channelReportLimiter };

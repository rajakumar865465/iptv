const rateLimit = require('express-rate-limit');

// Helper: normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
// and strip IPv6 brackets so keys are consistent. This prevents ERR_ERL_KEY_GEN_IPV6.
const normalizeIp = (ip) => {
  if (!ip) return 'unknown';
  // Strip IPv6 brackets [::1] → ::1
  const stripped = ip.replace(/^\[|\]$/g, '');
  // Map ::ffff:x.x.x.x → x.x.x.x
  const v4mapped = stripped.replace(/^::ffff:/i, '');
  return v4mapped;
};

const ipKeyGenerator = (req) => normalizeIp(req.ip);

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000,  // Restored to 3000 - admin polling triggers 429s otherwise
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,  // Restored to 5000
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'API rate limit exceeded. Please try again later.' });
  },
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,  // Restored to 1000
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many search requests. Please slow down.' });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,  // Reduced from 100 - still generous for auth attempts
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many auth attempts, please try again later.' });
  },
});

// Token refresh happens automatically in the background (Dio interceptor on 401s),
// so it needs a much higher ceiling than interactive login/signup attempts.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
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
  keyGenerator: (req) => `${normalizeIp(req.ip)}:${req.params.id || '0'}`,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many reports for this channel. Please try again later.' });
  },
});

// Manual UPI payment submissions. Each one creates a pending order that a human
// has to review, so the ceiling is deliberately low — this is the throttle that
// stops someone flooding the admin verification queue with bogus UTRs.
const manualOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many payment submissions. Please try again later or contact support on WhatsApp.' });
  },
});

// Looking up a pending order (polled by the payment-status page). Order ids are
// random, but this still caps brute-force enumeration attempts.
const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: ipKeyGenerator,
  validate: { trustProxy: false, ip: false },
  handler: (req, res, next, options) => {
    res.status(429).json({ success: false, message: 'Too many order lookups. Please wait a moment and try again.' });
  },
});


module.exports = { standardLimiter, apiLimiter, searchLimiter, authLimiter, refreshLimiter, channelReportLimiter, manualOrderLimiter, orderLookupLimiter };

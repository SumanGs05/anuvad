const rateLimit = require('express-rate-limit');

/**
 * Express-rate-limit uses req.ip by default. When app.set('trust proxy')
 * is configured, Express resolves req.ip from X-Forwarded-For, so each
 * real client IP gets its own bucket even behind Railway's load balancer.
 */
function keyGenerator(req) {
  return req.ip || '::1';
}

/**
 * General API rate limit - generous enough for normal use.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many requests. Please try again later.' }
});

/**
 * Strict limiter for authentication endpoints: 5 attempts per 15 minutes
 * per IP, to slow down credential-stuffing / brute-force attempts.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

/**
 * Refresh and logout are called automatically by the frontend, so they get
 * their own, looser bucket. Login and register stay on the strict one.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many token requests. Please try again later.' }
});

/**
 * Slightly stricter limiter for the upload endpoint, since it is the most
 * resource-intensive route.
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many upload requests. Please try again later.' }
});

module.exports = { generalLimiter, authLimiter, refreshLimiter, uploadLimiter };

const rateLimit = require('express-rate-limit');

/**
 * General API rate limit - generous enough for normal use, but bounds
 * abuse of any endpoint.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

/**
 * Slightly stricter limiter for the upload endpoint, since it is the most
 * resource-intensive route (kicks off the full translation pipeline).
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please try again later.' }
});

module.exports = { generalLimiter, authLimiter, uploadLimiter };

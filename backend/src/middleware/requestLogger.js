/**
 * Request logger: logs method, path (no query string), status, duration,
 * and a per-request ID. Never logs request bodies, headers, or query params.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  // Attach so downstream code can correlate logs.
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Path only, no query string.
    const pathOnly = req.path || '/';
    logger.info('HTTP request', {
      requestId,
      method: req.method,
      path: pathOnly,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}

module.exports = { requestLogger };

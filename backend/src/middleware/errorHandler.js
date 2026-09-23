const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Central error-handling middleware. Detailed error information (stack
 * traces, provider error bodies, etc.) is only ever logged server-side;
 * clients always receive a generic, safe message.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('Unhandled request error', err, { path: req.path, method: req.method });

  if (res.headersSent) {
    return undefined;
  }

  const status = err.status || 500;

  // In production, never reveal internal error details or stack traces.
  let publicMessage;
  if (status < 500 && err.publicMessage) {
    publicMessage = err.publicMessage;
  } else if (env.nodeEnv !== 'production' && err.message) {
    publicMessage = err.message;
  } else {
    publicMessage = 'Something went wrong. Please try again.';
  }

  return res.status(status).json({ error: publicMessage });
}

function notFoundHandler(req, res) {
  return res.status(404).json({ error: 'Not found' });
}

module.exports = { errorHandler, notFoundHandler };

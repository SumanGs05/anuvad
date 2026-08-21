/**
 * Minimal structured logger. Deliberately never accepts raw error objects
 * that might contain secrets in their message chain without redaction -
 * callers should pass a short server-side message plus a safe context
 * object. Stack traces are logged server-side only, never sent to clients.
 */
function info(message, context = {}) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', message, ...context, ts: new Date().toISOString() }));
}

function warn(message, context = {}) {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({ level: 'warn', message, ...context, ts: new Date().toISOString() }));
}

function error(message, err, context = {}) {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      errorMessage: err && err.message,
      stack: err && err.stack,
      ...context,
      ts: new Date().toISOString()
    })
  );
}

module.exports = { info, warn, error };

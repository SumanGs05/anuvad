/**
 * Simple in-process FIFO queue for pipeline jobs.
 * Caps parallel executions at env.maxConcurrentJobs (default 2).
 * Additional jobs wait until a slot is free.
 */
const env = require('../config/env');
const logger = require('./logger');

let running = 0;
const waiting = [];

function runNext() {
  if (running >= env.maxConcurrentJobs || waiting.length === 0) return;
  const { fn, resolve, reject, jobId } = waiting.shift();
  running += 1;
  logger.info('Pipeline slot acquired', { jobId, running, queued: waiting.length });
  Promise.resolve()
    .then(fn)
    .then(resolve, reject)
    .finally(() => {
      running -= 1;
      logger.info('Pipeline slot released', { jobId, running, queued: waiting.length });
      runNext();
    });
}

/**
 * Enqueue a pipeline function. Returns a promise that resolves/rejects
 * when the function completes. The function is called with no arguments.
 */
function enqueue(fn, jobId) {
  return new Promise((resolve, reject) => {
    waiting.push({ fn, resolve, reject, jobId: String(jobId) });
    logger.info('Job enqueued', { jobId: String(jobId), running, queued: waiting.length });
    runNext();
  });
}

function queueStats() {
  return { running, queued: waiting.length };
}

module.exports = { enqueue, queueStats };

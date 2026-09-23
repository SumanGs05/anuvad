/**
 * Retention: deletes uploaded and translated files older than
 * env.retentionDays and marks their jobs as 'expired'.
 *
 * Runs once at startup and every 6 hours thereafter.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('./logger');

// Lazy require to avoid circular dependency at startup.
function getJob() {
  return require('../models/Job');
}

async function runRetention() {
  const cutoffMs = env.retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cutoffMs);

  logger.info('Retention sweep started', { retentionDays: env.retentionDays, cutoff: cutoff.toISOString() });

  const Job = getJob();

  const expiredJobs = await Job.find({
    createdAt: { $lt: cutoff },
    status: { $nin: ['expired'] },
  });

  let filesDeleted = 0;
  let jobsExpired = 0;

  for (const job of expiredJobs) {
    // Delete uploaded file
    if (job.storedFilePath) {
      const uploadedPath = path.join(env.storageDir, job.storedFilePath);
      if (fs.existsSync(uploadedPath)) {
        try {
          fs.unlinkSync(uploadedPath);
          filesDeleted += 1;
        } catch (err) {
          logger.warn('Could not delete uploaded file during retention sweep', { jobId: job._id.toString(), error: err.message });
        }
      }
    }

    // Delete translated file
    if (job.translatedFilePath) {
      const translatedPath = path.join(env.storageDir, job.translatedFilePath);
      if (fs.existsSync(translatedPath)) {
        try {
          fs.unlinkSync(translatedPath);
          filesDeleted += 1;
        } catch (err) {
          logger.warn('Could not delete translated file during retention sweep', { jobId: job._id.toString(), error: err.message });
        }
      }
    }

    job.status = 'expired';
    job.errorMessage = `Files deleted after ${env.retentionDays} day retention period.`;
    await job.save();
    jobsExpired += 1;
  }

  logger.info('Retention sweep complete', { filesDeleted, jobsExpired });
}

let retentionTimer = null;

function scheduleRetention() {
  // Run once immediately, then every 6 hours.
  runRetention().catch((err) => logger.error('Retention sweep failed', err));

  retentionTimer = setInterval(
    () => runRetention().catch((err) => logger.error('Retention sweep failed', err)),
    6 * 60 * 60 * 1000
  );

  // Don't keep the process alive just for retention.
  if (retentionTimer.unref) retentionTimer.unref();
}

module.exports = { runRetention, scheduleRetention };

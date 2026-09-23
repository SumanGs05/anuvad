const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const Job = require('../models/Job');
const AuditLog = require('../models/AuditLog');
const { parseDocument } = require('../services/parsing.service');
const { translateBlocks } = require('../services/translation.service');
// Refinement is disabled in the current pipeline; import removed.
// refinement.service.js and its tests are retained for future use.
const { reconstructDocument } = require('../services/reconstruction.service');
const { enqueue } = require('../utils/queue');
const logger = require('../utils/logger');
const env = require('../config/env');

const STORAGE_DIR = env.storageDir;
const TRANSLATED_DIR = path.join(STORAGE_DIR, 'translated');

function safeDownloadName(name, ext) {
  const base =
    path
      .basename(name, path.extname(name))
      .replace(/[^a-zA-Z0-9._-]/g, '_') ||
    'translated-document';
  return `${base}-translated.${ext}`;
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

// ============================================================================
// PDF PAGE COUNT CHECK
// ============================================================================

async function getPdfPageCount(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer, { pagerender: () => '' });
  return result.numpages || 0;
}

// ============================================================================
// PIPELINE
// ============================================================================

async function runPipeline(job) {
  try {
    const fullFilePath = path.join(STORAGE_DIR, job.storedFilePath);

    // Check PDF page limit before parsing.
    if (job.fileExtension === 'pdf') {
      const pageCount = await getPdfPageCount(fullFilePath);
      if (pageCount > env.maxPdfPages) {
        job.status = 'failed';
        job.errorMessage = `PDF has ${pageCount} pages. Maximum allowed is ${env.maxPdfPages}.`;
        await job.save();
        logger.warn('Job rejected: PDF exceeds page limit', {
          jobId: job._id.toString(),
          pageCount,
          maxPdfPages: env.maxPdfPages
        });
        return;
      }
    }

    // Parsing
    job.status = 'parsing';
    await job.save();

    const parsed = await parseDocument({
      filePath: fullFilePath,
      ext: job.fileExtension
    });

    logger.info('Document parsed', {
      jobId: job._id.toString(),
      blockCount: parsed.blocks.length
    });

    // Translation
    job.status = 'translating';
    await job.save();

    const translated = await translateBlocks(
      parsed.blocks,
      job.targetLanguage,
      job.sourceLanguage
    );

    // Refinement is currently disabled.
    // When re-enabled: import refineBlocks from refinement.service and call it here.
    job.status = 'refining';
    await job.save();
    const refined = translated;

    // Reconstruction
    job.status = 'reconstructing';
    await job.save();

    const outputExt = job.fileExtension === 'docx' ? 'docx' : 'pdf';
    const outputFilename = `${uuidv4()}.${outputExt}`;

    await reconstructDocument({
      blocks: refined,
      sourceExt: job.fileExtension,
      outputPath: path.join(TRANSLATED_DIR, outputFilename),
      targetLanguage: job.targetLanguage
    });

    job.translatedFilePath = path.join('translated', outputFilename);
    job.status = 'completed';
    await job.save();

    await AuditLog.create({
      user: job.user,
      action: 'job.status_changed',
      job: job._id,
      metadata: { status: 'completed' }
    }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  } catch (err) {
    logger.error('Pipeline failed', err, { jobId: job._id.toString() });

    job.status = 'failed';
    job.errorMessage = 'Translation could not be completed.';
    await job.save();

    await AuditLog.create({
      user: job.user,
      action: 'job.failed',
      job: job._id,
      metadata: {}
    }).catch((e) => logger.warn('AuditLog write failed', { error: e.message }));
  }
}

// ============================================================================
// STARTUP SWEEP
// ============================================================================

/**
 * On startup, any job stuck in an intermediate processing state was
 * interrupted by a previous crash or restart. Mark them failed so the
 * client does not poll forever.
 */
async function sweepStuckJobs() {
  const stuckStatuses = ['uploaded', 'parsing', 'translating', 'refining', 'reconstructing'];
  const result = await Job.updateMany(
    { status: { $in: stuckStatuses } },
    {
      $set: {
        status: 'failed',
        errorMessage: 'Job was interrupted when the server restarted.'
      }
    }
  );
  if (result.modifiedCount > 0) {
    logger.warn('Swept stuck jobs on startup', { count: result.modifiedCount });
  }
}

// ============================================================================
// CREATE JOB (responds 202, runs pipeline asynchronously)
// ============================================================================

async function createJob(req, res) {
  const { targetLanguage } = req.body;
  const userId = req.user._id;

  // Daily job limit check (rolling 24 h window).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await Job.countDocuments({
    user: userId,
    createdAt: { $gte: since }
  });

  if (recentCount >= env.dailyJobLimit) {
    return res.status(429).json({
      error: `Daily job limit reached (${env.dailyJobLimit} jobs per 24 hours). Please try again later.`
    });
  }

  const job = await Job.create({
    user: userId,
    originalFilename: req.uploadedFile.originalName,
    storedFilePath: req.uploadedFile.relativePath,
    mimeType: req.uploadedFile.mime,
    fileExtension: req.uploadedFile.ext,
    targetLanguage
  });

  await AuditLog.create({
    user: userId,
    action: 'job.created',
    job: job._id,
    ipAddress: clientIp(req),
    metadata: { targetLanguage, ext: req.uploadedFile.ext }
  }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  // Fire-and-forget: pipeline runs in the background queue.
  enqueue(() => runPipeline(job), job._id).catch((err) => {
    logger.error('Queue enqueue error', err, { jobId: job._id.toString() });
  });

  // Return 202 Accepted immediately.
  return res.status(202).json({ job });
}

// ============================================================================
// LIST JOBS
// ============================================================================

async function listJobs(req, res) {
  const jobs = await Job.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json({ jobs });
}

// ============================================================================
// GET JOB
// ============================================================================

async function getJob(req, res) {
  const job = await Job.findOne({ _id: req.params.jobId, user: req.user._id });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ job });
}

// ============================================================================
// DOWNLOAD JOB
// ============================================================================

async function downloadJob(req, res) {
  const job = await Job.findOne({ _id: req.params.jobId, user: req.user._id });

  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.status !== 'completed' || !job.translatedFilePath) {
    return res.status(409).json({ error: 'Translation is not ready for download' });
  }

  const resolved = path.resolve(STORAGE_DIR, job.translatedFilePath);

  if (
    !resolved.startsWith(`${path.resolve(TRANSLATED_DIR)}${path.sep}`) ||
    !fs.existsSync(resolved)
  ) {
    return res.status(404).json({ error: 'Translated file is unavailable' });
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'job.downloaded',
    job: job._id,
    ipAddress: clientIp(req),
    metadata: {}
  }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  return res.download(
    resolved,
    safeDownloadName(job.originalFilename, path.extname(resolved).slice(1))
  );
}

// ============================================================================
// DELETE JOB (owner only)
// ============================================================================

async function deleteJob(req, res) {
  const job = await Job.findOne({ _id: req.params.jobId, user: req.user._id });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Delete uploaded file
  if (job.storedFilePath) {
    const uploadedPath = path.join(STORAGE_DIR, job.storedFilePath);
    if (fs.existsSync(uploadedPath)) {
      try { fs.unlinkSync(uploadedPath); } catch (err) {
        logger.warn('Could not delete uploaded file on job delete', { jobId: job._id.toString(), error: err.message });
      }
    }
  }

  // Delete translated file
  if (job.translatedFilePath) {
    const translatedPath = path.join(STORAGE_DIR, job.translatedFilePath);
    if (fs.existsSync(translatedPath)) {
      try { fs.unlinkSync(translatedPath); } catch (err) {
        logger.warn('Could not delete translated file on job delete', { jobId: job._id.toString(), error: err.message });
      }
    }
  }

  await Job.deleteOne({ _id: job._id });

  return res.status(200).json({ message: 'Job deleted' });
}

module.exports = {
  createJob,
  listJobs,
  getJob,
  downloadJob,
  deleteJob,
  runPipeline,
  sweepStuckJobs
};

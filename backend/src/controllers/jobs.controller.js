const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Job = require('../models/Job');
const { parseDocument } = require('../services/parsing.service');
const { translateBlocks } = require('../services/translation.service');
const { refineBlocks } = require('../services/refinement.service');
const { reconstructDocument } = require('../services/reconstruction.service');
const logger = require('../utils/logger');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const TRANSLATED_DIR = path.join(STORAGE_DIR, 'translated');

function safeDownloadName(name, ext) {
  const base = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'translated-document';
  return `${base}-${ext === 'pdf' ? 'translated' : 'translated'}.${ext}`;
}

async function runPipeline(job) {
  try {
    job.status = 'parsing';
    await job.save();
    const parsed = await parseDocument({ filePath: path.join(STORAGE_DIR, job.storedFilePath), ext: job.fileExtension });

    job.status = 'translating';
    await job.save();
    const translated = await translateBlocks(parsed.blocks, job.targetLanguage, job.sourceLanguage);

    job.status = 'refining';
    await job.save();
    const refined = await refineBlocks(parsed.blocks, translated, job.targetLanguage);

    job.status = 'reconstructing';
    await job.save();
    const outputExt = job.fileExtension === 'docx' ? 'docx' : 'pdf';
    const outputFilename = `${uuidv4()}.${outputExt}`;
    await reconstructDocument({ blocks: refined, sourceExt: job.fileExtension, outputPath: path.join(TRANSLATED_DIR, outputFilename) });

    job.translatedFilePath = path.join('translated', outputFilename);
    job.status = 'completed';
    await job.save();
  } catch (err) {
    logger.error('jobs pipeline failed', err, { jobId: job._id.toString() });
    job.status = 'failed';
    job.errorMessage = 'Translation could not be completed.';
    await job.save();
  }
}

async function createJob(req, res) {
  const targetLanguage = req.body.targetLanguage;
  const job = await Job.create({
    user: req.user._id,
    originalFilename: req.uploadedFile.originalName,
    storedFilePath: req.uploadedFile.relativePath,
    mimeType: req.uploadedFile.mime,
    fileExtension: req.uploadedFile.ext,
    targetLanguage
  });
  await runPipeline(job);
  return res.status(201).json({ job });
}

async function listJobs(req, res) {
  const jobs = await Job.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json({ jobs });
}

async function getJob(req, res) {
  const job = await Job.findOne({ _id: req.params.jobId, user: req.user._id });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ job });
}

async function downloadJob(req, res) {
  const job = await Job.findOne({ _id: req.params.jobId, user: req.user._id });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'completed' || !job.translatedFilePath) {
    return res.status(409).json({ error: 'Translation is not ready for download' });
  }
  const resolved = path.resolve(STORAGE_DIR, job.translatedFilePath);
  if (!resolved.startsWith(`${path.resolve(TRANSLATED_DIR)}${path.sep}`) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Translated file is unavailable' });
  }
  return res.download(resolved, safeDownloadName(job.originalFilename, path.extname(resolved).slice(1)));
}

module.exports = { createJob, listJobs, getJob, downloadJob, runPipeline };

const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const { handleUpload } = require('../middleware/upload');
const validate = require('../middleware/validate');
const controller = require('../controllers/jobs.controller');
const { SUPPORTED_LANGUAGES } = require('../models/Job');

const router = express.Router();
const createJobSchema = z.object({ targetLanguage: z.enum(SUPPORTED_LANGUAGES) });

router.use(requireAuth);
router.post('/', uploadLimiter, handleUpload, validate(createJobSchema), controller.createJob);
router.get('/', controller.listJobs);
router.get('/:jobId/download', controller.downloadJob);
router.get('/:jobId', controller.getJob);
router.delete('/:jobId', controller.deleteJob);
module.exports = router;

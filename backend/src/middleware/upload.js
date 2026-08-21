const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { detectFileType } = require('../utils/fileType');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'storage', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Buffer the file in memory first so we can inspect its real bytes before
// ever writing anything to disk with a client-controlled name.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
}).single('document');

/**
 * Handles a single-file upload:
 *  1. Enforces the 10MB size limit (via multer).
 *  2. Detects the real file type from its bytes (never trusts the
 *     client-supplied extension or Content-Type header).
 *  3. Rejects anything outside the allow-list (.docx, .pdf, .jpg, .png).
 *  4. Writes the file to disk under a random, non-guessable filename.
 *
 * On success, sets `req.uploadedFile = { path, filename, mime, ext, size }`.
 */
function handleUpload(req, res, next) {
  memoryUpload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds the 10MB size limit' });
      }
      return res.status(400).json({ error: 'File upload failed' });
    }
    if (err) {
      return next(err);
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const detected = await detectFileType(req.file.buffer);
    if (!detected) {
      return res.status(415).json({ error: 'Unsupported or unrecognized file type. Allowed: .docx, .pdf, .jpg, .png' });
    }

    const randomFilename = `${uuidv4()}.${detected.ext}`;
    const destination = path.join(UPLOAD_DIR, randomFilename);

    try {
      fs.writeFileSync(destination, req.file.buffer);
    } catch (writeErr) {
      return next(writeErr);
    }

    req.uploadedFile = {
      path: destination,
      relativePath: path.join('uploads', randomFilename),
      filename: randomFilename,
      mime: detected.mime,
      ext: detected.ext,
      size: req.file.size,
      originalName: req.file.originalname
    };

    return next();
  });
}

module.exports = { handleUpload, UPLOAD_DIR, MAX_FILE_SIZE_BYTES };

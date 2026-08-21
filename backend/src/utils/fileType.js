const fileType = require('file-type');
// file-type v16 exposes `fromBuffer`; newer versions use `fileTypeFromBuffer`.
// Supporting both keeps this security check aligned with the declared package.
const fileTypeFromBuffer = fileType.fileTypeFromBuffer || fileType.fromBuffer;

/**
 * Allowed upload types: Word documents, PDFs, and JPEG/PNG images.
 * Mapped by the "true" MIME type/extension detected from file bytes,
 * never trusted from the client-supplied filename or Content-Type header.
 */
const ALLOWED_TYPES = {
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  jpg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' }
};

const ALLOWED_MIME_TYPES = new Set(Object.values(ALLOWED_TYPES).map((t) => t.mime));

/**
 * Inspects the actual bytes of a file buffer to determine its real type,
 * rather than trusting the client-supplied extension/MIME type. Returns
 * null if the type could not be determined or isn't in the allow-list.
 */
async function detectFileType(buffer) {
  const detected = await fileTypeFromBuffer(buffer);

  // Legacy .doc (application/msword) files are not detectable the same way
  // and are intentionally NOT supported - only modern .docx is accepted.
  if (!detected) return null;
  if (!ALLOWED_MIME_TYPES.has(detected.mime)) return null;

  return { mime: detected.mime, ext: detected.ext === 'jpeg' ? 'jpg' : detected.ext };
}

module.exports = { detectFileType, ALLOWED_TYPES, ALLOWED_MIME_TYPES };

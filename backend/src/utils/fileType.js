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
 * Cheap magic-byte gate. file-type 16.x has an infinite loop on crafted ASF
 * input, so only buffers that start like one of our four allowed formats
 * are ever passed to it.
 */
function hasAllowedMagic(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  const isPdf = buf.toString('latin1', 0, 4) === '%PDF';
  const isPng = buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG';
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  return isPdf || isPng || isJpg || isZip;
}

/**
 * Inspects the actual bytes of a file buffer to determine its real type,
 * rather than trusting the client-supplied extension/MIME type. Returns
 * null if the type could not be determined or isn't in the allow-list.
 */
async function detectFileType(buffer) {
  if (!hasAllowedMagic(buffer)) return null;
  const detected = await fileTypeFromBuffer(buffer);

  // Legacy .doc (application/msword) files are not detectable the same way
  // and are intentionally NOT supported - only modern .docx is accepted.
  if (!detected) return null;
  if (!ALLOWED_MIME_TYPES.has(detected.mime)) return null;

  return { mime: detected.mime, ext: detected.ext === 'jpeg' ? 'jpg' : detected.ext };
}

module.exports = { detectFileType, ALLOWED_TYPES, ALLOWED_MIME_TYPES };

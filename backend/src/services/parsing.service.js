const fs = require('fs');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const sarvamClient = require('./sarvamClient');
const logger = require('../utils/logger');

/**
 * Document parsing service.
 *
 * Extracts text with structure preserved (headings / paragraphs / tables)
 * from an uploaded document. For .docx and .pdf we use battle-tested local
 * libraries (mammoth / pdf-parse) as the primary path, since they are
 * deterministic and don't depend on network access - this keeps the
 * pipeline fast and reliable for a local demo. For images (.jpg/.png),
 * where no reliable local OCR is available, we call Sarvam's Document
 * Intelligence API.
 *
 * Output shape: { blocks: [{ type: 'heading'|'paragraph'|'table', level?, text?, rows? }] }
 */

function htmlToBlocks(html) {
  const blocks = [];
  // Very small, dependency-free HTML walker sufficient for mammoth's output
  // (headings, paragraphs, and simple tables).
  const tagRegex = /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const [, tag, inner] = match;
    if (tag === 'table') {
      const rows = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(inner)) !== null) {
        const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
          stripTags(c[1]).trim()
        );
        rows.push(cells);
      }
      blocks.push({ type: 'table', rows });
    } else if (tag.startsWith('h')) {
      blocks.push({ type: 'heading', level: Number(tag[1]), text: stripTags(inner).trim() });
    } else {
      const text = stripTags(inner).trim();
      if (text) blocks.push({ type: 'paragraph', text });
    }
  }
  return blocks;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function parseDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const blocks = htmlToBlocks(html);
  if (blocks.length === 0) {
    throw new Error('No extractable text found in document');
  }
  return blocks;
}

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { text } = await pdfParse(buffer);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    throw new Error('No extractable text found in document');
  }

  return paragraphs.map((text) => {
    // Heuristic: short, title-cased/uppercase lines are treated as headings.
    const isHeadingLike = text.length < 80 && /^[A-Z0-9][A-Z0-9\s.,'&-]*$/.test(text);
    return isHeadingLike ? { type: 'heading', level: 2, text } : { type: 'paragraph', text };
  });
}

async function parseImage(filePath, sourceLanguage) {
  const text = await sarvamClient.parseImageDocument({ filePath, sourceLanguage });
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    throw new Error('No extractable text found in image');
  }
  return paragraphs.map((text) => ({ type: 'paragraph', text }));
}

/**
 * @param {{ filePath: string, ext: 'docx'|'pdf'|'jpg'|'png', sourceLanguage?: string }} params
 * @returns {Promise<{ blocks: Array }>}
 */
async function parseDocument({ filePath, ext, sourceLanguage = 'en' }) {
  try {
    let blocks;
    if (ext === 'docx') {
      blocks = await parseDocx(filePath);
    } else if (ext === 'pdf') {
      blocks = await parsePdf(filePath);
    } else if (ext === 'jpg' || ext === 'png') {
      blocks = await parseImage(filePath, sourceLanguage);
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }
    return { blocks };
  } catch (err) {
    logger.error('parsing.service.parseDocument failed', err, { ext });
    throw err;
  }
}

module.exports = { parseDocument, htmlToBlocks };

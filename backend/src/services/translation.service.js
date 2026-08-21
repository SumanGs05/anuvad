const sarvamClient = require('./sarvamClient');

const MAX_CHUNK_LENGTH = 1800; // stays under Sarvam Translate's per-request character cap

/**
 * Splits long text into chunks that fit within the translation API's
 * per-request character limit, breaking on sentence boundaries where
 * possible so translations stay coherent.
 */
function chunkText(text, maxLength = MAX_CHUNK_LENGTH) {
  if (text.length <= maxLength) return [text];

  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > maxLength) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

async function translatePlainText(text, targetLanguage, sourceLanguage) {
  if (!text || !text.trim()) return text;
  const chunks = chunkText(text);
  const translatedChunks = [];
  for (const chunk of chunks) {
    // Sequential to respect provider rate limits in this local prototype.
    // eslint-disable-next-line no-await-in-loop
    const translated = await sarvamClient.translateText({
      text: chunk,
      sourceLanguage,
      targetLanguage
    });
    translatedChunks.push(translated);
  }
  return translatedChunks.join(' ');
}

/**
 * Translates every block produced by the parsing service, preserving
 * document structure (headings / paragraphs / tables).
 */
async function translateBlocks(blocks, targetLanguage, sourceLanguage = 'en') {
  const translated = [];
  for (const block of blocks) {
    if (block.type === 'table') {
      const rows = [];
      for (const row of block.rows) {
        const translatedRow = [];
        for (const cell of row) {
          // eslint-disable-next-line no-await-in-loop
          translatedRow.push(await translatePlainText(cell, targetLanguage, sourceLanguage));
        }
        rows.push(translatedRow);
      }
      translated.push({ ...block, rows });
    } else {
      // eslint-disable-next-line no-await-in-loop
      const text = await translatePlainText(block.text, targetLanguage, sourceLanguage);
      translated.push({ ...block, text });
    }
  }
  return translated;
}

module.exports = { translateBlocks, translatePlainText, chunkText };

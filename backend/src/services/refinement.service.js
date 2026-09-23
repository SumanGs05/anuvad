const sarvamClient = require('./sarvamClient');

const LANGUAGE_NAMES = {
  hi: 'Hindi',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu'
};

// Credit-control settings
const MIN_REFINEMENT_LENGTH = 400;
const MAX_REFINEMENT_CHUNK = 1000;

/**
 * Split text into reasonably sized chunks for the refinement model.
 * Prefer sentence boundaries so we don't cut sentences in half.
 */
function chunkText(text, maxLength = MAX_REFINEMENT_CHUNK) {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current
      ? `${current} ${sentence}`
      : sentence;

    if (candidate.length > maxLength && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Builds the glossary section for the selected language.
 */
function buildGlossarySection(targetLanguage) {
  // Keep this compatible with the existing glossary if present.
  try {
    const { IP_GLOSSARY } = require('./glossary.data');

    const lines = IP_GLOSSARY
      .map((entry) => {
        const term = entry.translations[targetLanguage];

        if (!term) return null;

        return `- "${entry.englishTerm}" -> "${term}"`;
      })
      .filter(Boolean);

    return lines.join('\n');
  } catch (err) {
    return '';
  }
}

/**
 * System prompt for Sarvam 105B.
 *
 * 105B is treated as a final professional translation/editor,
 * not merely a proofreader of the machine translation.
 */
function buildSystemPrompt(targetLanguage) {
  const languageName =
    LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  const glossarySection =
    buildGlossarySection(targetLanguage);

  return [
    `You are a senior professional translator for the Government of India.`,

    `Translate and polish the provided English source into ${languageName}.`,

    `The English text is the ABSOLUTE SOURCE OF TRUTH.`,

    `The machine translation is only a reference draft. Do NOT preserve awkward wording just because it appears in the draft.`,

    ``,

    `Your final answer must:`,

    `1. Preserve 100% of the meaning of the English source.`,

    `2. Use natural, fluent ${languageName}.`,

    `3. Sound like an official Indian government publication.`,

    `4. Use established legal and intellectual-property terminology.`,

    `5. Correct grammar, word order, sentence structure, and unnatural literal translations.`,

    `6. Never add information that is absent from the English.`,

    `7. Never remove information from the English.`,

    `8. Preserve names, abbreviations, numbers, and factual information.`,

    `9. Keep CIPAM, IP, and other standard abbreviations where appropriate.`,

    `10. Return ONLY the final ${languageName} translation.`,

    `11. Do NOT explain your changes.`,

    `12. Do NOT mention the machine translation.`,

    ``,

    `Required terminology:`,

    glossarySection || '(no glossary terms specified)',

    ``,

    `The result should read as if it was written by a professional native ${languageName} government/legal translator.`
  ].join('\n');
}

/**
 * Refines a single translated text segment.
 *
 * Credit-saving strategy:
 * - Short text (<400 chars): don't call 105B.
 * - Long text: split into <=1000 character chunks.
 * - Each chunk gets one 105B request.
 */
async function refineText({
  originalText,
  baseTranslation,
  targetLanguage
}) {
  if (!baseTranslation || !baseTranslation.trim()) {
    return baseTranslation;
  }

  if (!originalText || !originalText.trim()) {
    return baseTranslation;
  }

  // Do not waste 105B credits on short text.
  // Headings, short labels, and short sentences are usually
  // already handled well by sarvam-translate:v1.
  if (originalText.trim().length < MIN_REFINEMENT_LENGTH) {
    return baseTranslation;
  }

  const originalChunks = chunkText(
    originalText,
    MAX_REFINEMENT_CHUNK
  );

  const translationChunks = chunkText(
    baseTranslation,
    MAX_REFINEMENT_CHUNK
  );

  const refinedChunks = [];

  // Use the number of source chunks as the authoritative count.
  // This prevents accidental loss if the translated text has
  // slightly different sentence/chunk boundaries.
  for (let i = 0; i < originalChunks.length; i += 1) {
    const originalChunk = originalChunks[i];

    // If translation has fewer chunks, use the remaining
    // translation as a fallback rather than generating nothing.
    const translationChunk =
      translationChunks[i] ||
      baseTranslation;

    try {
      // eslint-disable-next-line no-await-in-loop
      const refined = await sarvamClient.chatCompletion({
        systemPrompt: buildSystemPrompt(targetLanguage),

        userPrompt: [
          `ENGLISH SOURCE:`,
          originalChunk,
          ``,
          `REFERENCE MACHINE TRANSLATION:`,
          translationChunk,
          ``,
          `Produce the FINAL ${LANGUAGE_NAMES[targetLanguage] || targetLanguage} translation.`,
          `Rewrite the reference wherever necessary.`,
          `Return only the final translation.`
        ].join('\n'),

        // Slightly higher than the original 0.2 so 105B
        // can naturally rewrite awkward machine translation.
        temperature: 0.4
      });

      if (refined && refined.trim()) {
        refinedChunks.push(refined.trim());
      } else {
        // 105B returned empty — preserve the base translation.
        refinedChunks.push(translationChunk);
      }
    } catch (err) {
      // Never fail the entire document because refinement failed.
      refinedChunks.push(translationChunk);
    }
  }

  return refinedChunks.join('\n\n').trim();
}

/**
 * Refines every translated block while preserving
 * headings, paragraphs, and tables.
 */
async function refineBlocks(
  originalBlocks,
  translatedBlocks,
  targetLanguage
) {
  const refined = [];

  for (let i = 0; i < translatedBlocks.length; i += 1) {
    const original = originalBlocks[i];
    const translatedBlock = translatedBlocks[i];

    if (translatedBlock.type === 'table') {
      const rows = [];

      for (
        let r = 0;
        r < translatedBlock.rows.length;
        r += 1
      ) {
        const row = [];

        for (
          let c = 0;
          c < translatedBlock.rows[r].length;
          c += 1
        ) {
          const originalCell =
            original?.rows?.[r]?.[c] || '';

          const translatedCell =
            translatedBlock.rows[r][c];

          // eslint-disable-next-line no-await-in-loop
          const refinedCell = await refineText({
            originalText: originalCell,
            baseTranslation: translatedCell,
            targetLanguage
          });

          row.push(refinedCell);
        }

        rows.push(row);
      }

      refined.push({
        ...translatedBlock,
        rows
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      const text = await refineText({
        originalText: original?.text || '',
        baseTranslation: translatedBlock.text,
        targetLanguage
      });

      refined.push({
        ...translatedBlock,
        text
      });
    }
  }

  return refined;
}

module.exports = {
  refineBlocks,
  refineText,
  buildSystemPrompt,
  buildGlossarySection,
  chunkText
};

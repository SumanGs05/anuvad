const sarvamClient = require('./sarvamClient');
const { IP_GLOSSARY } = require('./glossary.data');

const LANGUAGE_NAMES = {
  hi: 'Hindi',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu'
};

/**
 * Builds the glossary section of the refinement prompt for a given target
 * language, so the LLM enforces consistent, legally correct terminology.
 */
function buildGlossarySection(targetLanguage) {
  const lines = IP_GLOSSARY.map((entry) => {
    const term = entry.translations[targetLanguage];
    if (!term) return null;
    return `- "${entry.englishTerm}" -> "${term}"`;
  }).filter(Boolean);
  return lines.join('\n');
}

function buildSystemPrompt(targetLanguage) {
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const glossarySection = buildGlossarySection(targetLanguage);

  return [
    `You are an expert legal-linguistic translator working for CIPAM (Cell for IPR Promotion and Management), an Indian government body.`,
    `Your task is to refine a machine-translated ${languageName} passage so that it reads naturally to a native ${languageName} reader while remaining a faithful translation of the original English text's true meaning (never a literal, word-for-word translation).`,
    ``,
    `Strict style requirements:`,
    `1. Use simple, formal, and non-colloquial ${languageName}. Avoid slang, regional idioms, and casual phrasing.`,
    `2. Preserve the original meaning and intent exactly - do not add, omit, or change facts.`,
    `3. Use correct, consistent intellectual-property/legal terminology. When any of the following English terms (or their translations) appear, use exactly the given ${languageName} term:`,
    glossarySection || '(no glossary terms apply)',
    `4. Keep sentence structure clear and readable; prefer short, precise sentences over long, convoluted ones.`,
    `5. Do not add commentary, explanations, or notes - return only the refined ${languageName} text, with no extra preamble.`
  ].join('\n');
}

/**
 * Refines a single translated text segment against its English original.
 */
async function refineText({ originalText, baseTranslation, targetLanguage }) {
  if (!baseTranslation || !baseTranslation.trim()) return baseTranslation;

  const systemPrompt = buildSystemPrompt(targetLanguage);
  const userPrompt = [
    `Original English text:`,
    originalText,
    ``,
    `Machine-translated draft:`,
    baseTranslation,
    ``,
    `Return only the refined translation.`
  ].join('\n');

  const refined = await sarvamClient.chatCompletion({ systemPrompt, userPrompt });
  return refined.trim() || baseTranslation;
}

/**
 * Refines every block, pairing each translated block with its original
 * (pre-translation) counterpart for meaning-fidelity context.
 */
async function refineBlocks(originalBlocks, translatedBlocks, targetLanguage) {
  const refined = [];
  for (let i = 0; i < translatedBlocks.length; i += 1) {
    const original = originalBlocks[i];
    const translatedBlock = translatedBlocks[i];

    if (translatedBlock.type === 'table') {
      const rows = [];
      for (let r = 0; r < translatedBlock.rows.length; r += 1) {
        const row = [];
        for (let c = 0; c < translatedBlock.rows[r].length; c += 1) {
          // eslint-disable-next-line no-await-in-loop
          const refinedCell = await refineText({
            originalText: original?.rows?.[r]?.[c] || '',
            baseTranslation: translatedBlock.rows[r][c],
            targetLanguage
          });
          row.push(refinedCell);
        }
        rows.push(row);
      }
      refined.push({ ...translatedBlock, rows });
    } else {
      // eslint-disable-next-line no-await-in-loop
      const text = await refineText({
        originalText: original?.text || '',
        baseTranslation: translatedBlock.text,
        targetLanguage
      });
      refined.push({ ...translatedBlock, text });
    }
  }
  return refined;
}

module.exports = { refineBlocks, refineText, buildSystemPrompt, buildGlossarySection };

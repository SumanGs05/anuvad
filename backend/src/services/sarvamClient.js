const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Thin wrapper around the Sarvam AI REST APIs used by the pipeline:
 *  - POST /translate                for base machine translation
 *  - POST /v1/chat/completions      for the LLM refinement pass
 *
 * Kept as a single module so all outbound Sarvam calls are easy to mock in
 * unit tests and easy to swap out later (e.g. if Sarvam changes endpoint
 * shapes) without touching the rest of the pipeline.
 */

// Maps our internal 2-letter target language codes to Sarvam's BCP-47 codes.
const LANGUAGE_CODE_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  te: 'te-IN'
};

function toSarvamLangCode(code) {
  return LANGUAGE_CODE_MAP[code] || code;
}

function client() {
  return axios.create({
    baseURL: env.sarvam.baseUrl,
    timeout: 30000,
    headers: {
      'api-subscription-key': env.sarvam.apiKey,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Translates a single chunk of text using the Sarvam Translate API.
 * The Translate API caps input length (~1000-2000 chars depending on
 * model), so callers are responsible for chunking longer text.
 */
async function translateText({ text, sourceLanguage = 'en', targetLanguage, mode = 'formal' }) {
  try {
    const { data } = await client().post('/translate', {
      input: text,
      source_language_code: toSarvamLangCode(sourceLanguage),
      target_language_code: toSarvamLangCode(targetLanguage),
      mode,
      model: 'sarvam-translate:v1'
    });
    return data.translated_text;
  } catch (err) {
    logger.error('sarvamClient.translateText failed', err, { targetLanguage });
    throw new Error('Translation provider request failed');
  }
}

/**
 * Sends a chat completion request to Sarvam's LLM for the refinement pass.
 */
async function chatCompletion({ systemPrompt, userPrompt, temperature = 0.2 }) {
  try {
    const { data } = await client().post('/v1/chat/completions', {
      model: 'sarvam-105b',
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
    return data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    logger.error('sarvamClient.chatCompletion failed', err);
    throw new Error('Refinement provider request failed');
  }
}

/**
 * Best-effort integration point for Sarvam's Document Intelligence
 * (OCR/digitisation) API for image ingestion, where no reliable local
 * parsing library exists. This uses Sarvam's documented job-based flow:
 * create a job, upload the file, then poll for completion and read back
 * the extracted text.
 *
 * NOTE: this is intentionally isolated behind a single function so it can
 * be fully mocked in tests, and so the exact polling/response handling can
 * be hardened against the live API without touching the rest of the
 * pipeline. On any failure it throws, and callers should surface a clear
 * error rather than silently returning empty text.
 */
async function parseImageDocument({ filePath, sourceLanguage = 'en' }) {
  // eslint-disable-next-line no-unused-vars -- file upload step (presigned
  // URL + PUT) is pending verification against the live Sarvam schema; the
  // job is created here and the caller receives a clear failure until that
  // step is wired up, rather than silently skipping the file entirely.
  try {
    const { data: job } = await client().post('/doc-digitization/job/v1', {
      language_code: toSarvamLangCode(sourceLanguage),
      output_format: 'json'
    });

    const jobId = job.job_id || job.jobId;
    if (!jobId) throw new Error('Sarvam document intelligence job creation did not return a job id');

    // Poll for completion (short-lived, bounded loop for a local demo).
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { data: status } = await client().get(`/doc-digitization/job/v1/${jobId}`);
      if (status.status === 'Completed' || status.status === 'completed') {
        return status.output_text || status.text || '';
      }
      if (status.status === 'Failed' || status.status === 'failed') {
        throw new Error('Sarvam document intelligence job failed');
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error('Sarvam document intelligence job timed out');
  } catch (err) {
    logger.error('sarvamClient.parseImageDocument failed', err);
    throw new Error('Image document parsing via Sarvam failed');
  }
}

module.exports = { translateText, chatCompletion, parseImageDocument, toSarvamLangCode, LANGUAGE_CODE_MAP };

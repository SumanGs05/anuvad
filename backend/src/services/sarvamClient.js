const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
       max_tokens: 4096,
       reasoning_effort: null,
       messages: [
         { role: 'system', content: systemPrompt },
         { role: 'user', content: userPrompt }
       ]
     });

     return data.choices?.[0]?.message?.content ?? '';
   } catch (err) {
     logger.error(
       'sarvamClient.chatCompletion failed',
       err.response?.data || err
     );
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
  try {
    // Sarvam's current Document AI API accepts the file directly as multipart
    // form data and starts a job in one request (not the legacy two-step API).
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    form.append('language', toSarvamLangCode(sourceLanguage));
    form.append('output_format', 'json');
    const { data: job } = await client().post('/doc-ai/v1/job/digitise', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const jobId = job.job_id;
    if (!jobId) throw new Error('Sarvam document intelligence job creation did not return a job id');

    const maxAttempts = 24;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { data: status } = await client().get(`/doc-ai/v1/job/${jobId}/status`);
      const state = String(status.status || '').toLowerCase();
      if (state === 'completed' || state === 'partially_completed') {
        const { data: results } = await client().get(`/doc-ai/v1/job/${jobId}/results`, { params: { format: 'json' } });
        const documents = results.documents || [];
        const text = documents.flatMap((document) => document.blocks || []).map((block) => block.text || '').filter(Boolean).join('\n\n');
        if (!text) throw new Error('Sarvam document intelligence returned no text');
        return text;
      }
      if (state === 'failed' || state === 'rejected') {
        throw new Error('Sarvam document intelligence job failed');
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Sarvam document intelligence job timed out');
  } catch (err) {
    logger.error('sarvamClient.parseImageDocument failed', err);
    throw new Error('Image document parsing via Sarvam failed');
  }
}

module.exports = { translateText, chatCompletion, parseImageDocument, toSarvamLangCode, LANGUAGE_CODE_MAP };

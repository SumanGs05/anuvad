const axios = require('axios');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Thin wrapper around the Sarvam AI REST APIs used by the pipeline.
 * API key is sent as a header only and is never logged.
 * Retries on 429 and 5xx with exponential backoff (max 3 attempts).
 */

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
 * Retry a request function on 429 (rate limit) or 5xx (server error).
 * Uses exponential backoff: 1s, 2s, 4s (capped at maxAttempts=3).
 */
async function withRetry(fn, label) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const retryable = status === 429 || (status >= 500 && status <= 599);
      if (!retryable || attempt === maxAttempts) {
        lastErr = err;
        break;
      }
      const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
      logger.warn(`${label} retrying after ${delayMs}ms`, { attempt, status });
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/**
 * Translates a single chunk of text using the Sarvam Translate API.
 * Callers are responsible for chunking longer text.
 */
async function translateText({ text, sourceLanguage = 'en', targetLanguage, mode = 'formal' }) {
  try {
    return await withRetry(async () => {
      const { data } = await client().post('/translate', {
        input: text,
        source_language_code: toSarvamLangCode(sourceLanguage),
        target_language_code: toSarvamLangCode(targetLanguage),
        mode,
        model: 'sarvam-translate:v1'
      });
      return data.translated_text;
    }, 'sarvamClient.translateText');
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
    return await withRetry(async () => {
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
    }, 'sarvamClient.chatCompletion');
  } catch (err) {
    logger.error('sarvamClient.chatCompletion failed', err.response?.status ? { status: err.response.status } : err);
    throw new Error('Refinement provider request failed');
  }
}

/**
 * Digitises an image document via Sarvam Doc AI.
 * Uses a job-based flow: create -> poll -> fetch results.
 */
async function parseImageDocument({ filePath, sourceLanguage = 'en' }) {
  try {
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
      // eslint-disable-next-line no-await-in-loop
      const { data: status } = await client().get(`/doc-ai/v1/job/${jobId}/status`);
      const state = String(status.status || '').toLowerCase();
      if (state === 'completed' || state === 'partially_completed') {
        // eslint-disable-next-line no-await-in-loop
        const { data: results } = await client().get(`/doc-ai/v1/job/${jobId}/results`, { params: { format: 'json' } });
        const documents = results.documents || [];
        const text = documents
          .flatMap((document) => document.blocks || [])
          .map((block) => block.text || '')
          .filter(Boolean)
          .join('\n\n');
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
    logger.error('sarvamClient.parseImageDocument failed', err instanceof Error ? err : new Error(String(err)));
    throw new Error('Image document parsing via Sarvam failed');
  }
}

module.exports = { translateText, chatCompletion, parseImageDocument, toSarvamLangCode, LANGUAGE_CODE_MAP };

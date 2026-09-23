/**
 * Centralised environment configuration validated with Zod.
 * All secrets are read from process.env (populated by dotenv) and never
 * hardcoded, logged, or echoed back in API responses.
 */
require('dotenv').config();

const { z } = require('zod');

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

// Placeholder used in test mode so the app boots without real secrets.
const TEST_PLACEHOLDER = 'test-placeholder-value-not-a-real-secret';

function testOr(value, fallback) {
  if (isTest && !value) return fallback;
  return value;
}

// --------------------------------------------------------------------------
// Schema helpers
// --------------------------------------------------------------------------

const requiredString = z.string().min(1);

// A secret that must be at least 32 characters in production.
const strongSecret = z
  .string()
  .min(32, 'Must be at least 32 characters');

// CORS origin: no localhost, no wildcard in production.
const prodCorsOrigin = z
  .string()
  .min(1)
  .refine(
    (v) =>
      !v.includes('localhost') &&
      !v.includes('127.0.0.1') &&
      !v.includes('*'),
    { message: 'CORS_ORIGIN must not contain localhost or wildcard in production' }
  );

// --------------------------------------------------------------------------
// Raw values
// --------------------------------------------------------------------------

const raw = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  MONGODB_URI: testOr(process.env.MONGODB_URI, 'mongodb://localhost:27017/anuvad-test'),
  JWT_ACCESS_SECRET: testOr(process.env.JWT_ACCESS_SECRET, TEST_PLACEHOLDER + '-access-secret-that-is-at-least-32'),
  JWT_REFRESH_SECRET: testOr(process.env.JWT_REFRESH_SECRET, TEST_PLACEHOLDER + '-refresh-secret-that-is-at-least-32'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  SARVAM_API_KEY: testOr(process.env.SARVAM_API_KEY, TEST_PLACEHOLDER),
  SARVAM_API_BASE_URL: process.env.SARVAM_API_BASE_URL || 'https://api.sarvam.ai',
  MONGO_ENCRYPTION_KEY: process.env.MONGO_ENCRYPTION_KEY || '',
  MONGO_SIGNING_KEY: process.env.MONGO_SIGNING_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  TRUST_PROXY: process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY : (isProd ? '1' : '0'),
  STORAGE_DIR: process.env.STORAGE_DIR || '',
  RETENTION_DAYS: process.env.RETENTION_DAYS || '7',
  DAILY_JOB_LIMIT: process.env.DAILY_JOB_LIMIT || '10',
  MAX_PDF_PAGES: process.env.MAX_PDF_PAGES || '50',
  MAX_CONCURRENT_JOBS: process.env.MAX_CONCURRENT_JOBS || '2',
  REGISTRATION_ENABLED: process.env.REGISTRATION_ENABLED !== undefined ? process.env.REGISTRATION_ENABLED : 'true',
};

// --------------------------------------------------------------------------
// Production validation
// --------------------------------------------------------------------------

if (isProd) {
  const prodSchema = z
    .object({
      MONGODB_URI: requiredString,
      JWT_ACCESS_SECRET: strongSecret,
      JWT_REFRESH_SECRET: strongSecret,
      SARVAM_API_KEY: requiredString,
      MONGO_ENCRYPTION_KEY: requiredString.min(1, 'MONGO_ENCRYPTION_KEY is required in production'),
      MONGO_SIGNING_KEY: requiredString.min(1, 'MONGO_SIGNING_KEY is required in production'),
      CORS_ORIGIN: prodCorsOrigin,
    })
    .refine(
      (d) => d.JWT_ACCESS_SECRET !== d.JWT_REFRESH_SECRET,
      { message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different', path: ['JWT_REFRESH_SECRET'] }
    );

  const result = prodSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => {
      const field = i.path.join('.') || 'unknown';
      return `  ${field}: ${i.message}`;
    });
    // Write directly to stderr - logger is not yet available at config load time.
    process.stderr.write(
      '[config] Production startup aborted. Fix these environment variables:\n' +
        problems.join('\n') +
        '\n(Values are never shown in error messages.)\n'
    );
    process.exit(1);
  }
}

// --------------------------------------------------------------------------
// Parse numeric / boolean helpers
// --------------------------------------------------------------------------

function posInt(str, fallback) {
  const n = parseInt(str, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseTrustProxy(str) {
  if (str === 'true' || str === '1') return 1;
  if (str === 'false' || str === '0') return 0;
  const n = parseInt(str, 10);
  if (Number.isFinite(n)) return n;
  return str; // e.g. a loopback or linklocal string
}

const path = require('path');

const env = {
  nodeEnv: raw.NODE_ENV,
  port: posInt(raw.PORT, 5000),

  mongoUri: raw.MONGODB_URI,

  jwt: {
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    accessExpiresIn: raw.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
  },

  sarvam: {
    apiKey: raw.SARVAM_API_KEY,
    baseUrl: raw.SARVAM_API_BASE_URL,
  },

  mongoEncryption: {
    encryptionKey: raw.MONGO_ENCRYPTION_KEY,
    signingKey: raw.MONGO_SIGNING_KEY,
  },

  corsOrigin: raw.CORS_ORIGIN,

  trustProxy: parseTrustProxy(raw.TRUST_PROXY),

  // Storage root: Railway volume or local fallback.
  storageDir: raw.STORAGE_DIR
    ? path.resolve(raw.STORAGE_DIR)
    : path.join(__dirname, '..', '..', 'storage'),

  retentionDays: posInt(raw.RETENTION_DAYS, 7),
  dailyJobLimit: posInt(raw.DAILY_JOB_LIMIT, 10),
  maxPdfPages: posInt(raw.MAX_PDF_PAGES, 50),
  maxConcurrentJobs: posInt(raw.MAX_CONCURRENT_JOBS, 2),
  registrationEnabled: raw.REGISTRATION_ENABLED !== 'false',
};

module.exports = env;

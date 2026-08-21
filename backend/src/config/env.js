/**
 * Centralised environment configuration.
 *
 * All secrets are read from process.env (populated by dotenv) and never
 * hardcoded, logged, or echoed back in API responses. Import this module
 * instead of touching `process.env` directly elsewhere in the codebase.
 */
require('dotenv').config();

function requireEnv(name, { optionalInTest = false } = {}) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'test' && optionalInTest) {
    return 'test-placeholder-value-not-a-real-secret';
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  mongoUri: requireEnv('MONGODB_URI', { optionalInTest: true }) || 'mongodb://localhost:27017/anuvad',

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET', { optionalInTest: true }),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', { optionalInTest: true }),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  sarvam: {
    apiKey: requireEnv('SARVAM_API_KEY', { optionalInTest: true }),
    baseUrl: process.env.SARVAM_API_BASE_URL || 'https://api.sarvam.ai'
  },

  mongoEncryption: {
    encryptionKey: process.env.MONGO_ENCRYPTION_KEY,
    signingKey: process.env.MONGO_SIGNING_KEY
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};

if (env.nodeEnv !== 'test') {
  const missing = [];
  if (!env.jwt.accessSecret) missing.push('JWT_ACCESS_SECRET');
  if (!env.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');
  if (!env.sarvam.apiKey) missing.push('SARVAM_API_KEY (translation calls will fail without it)');
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(`[config] Warning: missing environment variables: ${missing.join(', ')}`);
  }
}

module.exports = env;

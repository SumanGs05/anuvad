process.env.NODE_ENV = 'test';
const { z } = require('zod');

// Reproduce the production validation schema from env.js so we can test
// it in isolation without invoking process.exit.
const requiredString = z.string().min(1);
const strongSecret = z.string().min(32, 'Must be at least 32 characters');
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

const prodSchema = z
  .object({
    MONGODB_URI: requiredString,
    JWT_ACCESS_SECRET: strongSecret,
    JWT_REFRESH_SECRET: strongSecret,
    SARVAM_API_KEY: requiredString,
    MONGO_ENCRYPTION_KEY: requiredString,
    MONGO_SIGNING_KEY: requiredString,
    CORS_ORIGIN: prodCorsOrigin,
  })
  .refine(
    (d) => d.JWT_ACCESS_SECRET !== d.JWT_REFRESH_SECRET,
    { message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different', path: ['JWT_REFRESH_SECRET'] }
  );

const VALID = {
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SARVAM_API_KEY: 'sk-live-key',
  MONGO_ENCRYPTION_KEY: 'c'.repeat(32),
  MONGO_SIGNING_KEY: 'd'.repeat(32),
  CORS_ORIGIN: 'https://myapp.vercel.app',
};

describe('production env validation', () => {
  test('accepts a fully valid production config', () => {
    expect(prodSchema.safeParse(VALID).success).toBe(true);
  });

  test('rejects missing MONGODB_URI', () => {
    const result = prodSchema.safeParse({ ...VALID, MONGODB_URI: '' });
    expect(result.success).toBe(false);
  });

  test('rejects JWT_ACCESS_SECRET shorter than 32 chars', () => {
    const result = prodSchema.safeParse({ ...VALID, JWT_ACCESS_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  test('rejects identical JWT secrets', () => {
    const same = 'x'.repeat(32);
    const result = prodSchema.safeParse({ ...VALID, JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same });
    expect(result.success).toBe(false);
  });

  test('rejects CORS_ORIGIN containing localhost', () => {
    const result = prodSchema.safeParse({ ...VALID, CORS_ORIGIN: 'http://localhost:3000' });
    expect(result.success).toBe(false);
  });

  test('rejects CORS_ORIGIN with wildcard', () => {
    const result = prodSchema.safeParse({ ...VALID, CORS_ORIGIN: '*' });
    expect(result.success).toBe(false);
  });

  test('rejects missing MONGO_ENCRYPTION_KEY', () => {
    const result = prodSchema.safeParse({ ...VALID, MONGO_ENCRYPTION_KEY: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing MONGO_SIGNING_KEY', () => {
    const result = prodSchema.safeParse({ ...VALID, MONGO_SIGNING_KEY: '' });
    expect(result.success).toBe(false);
  });
});

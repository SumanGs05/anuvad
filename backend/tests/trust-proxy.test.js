process.env.NODE_ENV = 'test';
const express = require('express');
const request = require('supertest');
const { authLimiter } = require('../src/middleware/rateLimit');

describe('trust proxy and rate limiting', () => {
  test('rate limit buckets are keyed on X-Forwarded-For when trust proxy is set', async () => {
    const app = express();
    // Simulate trust proxy: Express resolves req.ip from X-Forwarded-For.
    app.set('trust proxy', 1);
    app.post('/login', authLimiter, (_req, res) => res.status(401).json({ error: 'bad creds' }));

    // Exhaust the limit for IP 1.2.3.4.
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/login').set('X-Forwarded-For', '1.2.3.4');
    }

    // IP 1.2.3.4 is now rate-limited.
    const blockedRes = await request(app)
      .post('/login')
      .set('X-Forwarded-For', '1.2.3.4');
    expect(blockedRes.status).toBe(429);

    // A different IP must NOT be limited.
    const otherRes = await request(app)
      .post('/login')
      .set('X-Forwarded-For', '5.6.7.8');
    expect(otherRes.status).toBe(401);

    authLimiter.resetKey('1.2.3.4');
    authLimiter.resetKey('5.6.7.8');
  });
});

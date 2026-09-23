process.env.NODE_ENV = 'test';
const express = require('express');
const request = require('supertest');
const { detectFileType } = require('../src/utils/fileType');

// Stub the controller so this test needs no database. The real limiters and
// route wiring are still what gets exercised.
jest.mock('../src/controllers/auth.controller', () => {
  const ok = (_req, res) => res.status(401).json({ error: 'stub' });
  return { register: ok, login: ok, refresh: ok, logout: ok };
});

describe('file type detection', () => {
  test('ASF header does not hang and is rejected quickly', async () => {
    const asfGuid = Buffer.from('3026B2758E66CF11A6D900AA0062CE6C', 'hex');
    const evil = Buffer.concat([asfGuid, Buffer.alloc(1024 * 1024)]);
    const start = Date.now();
    await expect(detectFileType(evil)).resolves.toBeNull();
    expect(Date.now() - start).toBeLessThan(500);
  });

  test('still accepts PDF, PNG and JPEG headers', async () => {
    expect((await detectFileType(Buffer.from('%PDF-1.4\n1 0 obj\n'))).ext).toBe('pdf');
    expect((await detectFileType(Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))).ext).toBe('png');
    expect((await detectFileType(Buffer.from('ffd8ffe000104a464946000101', 'hex'))).ext).toBe('jpg');
  });

  test('rejects plain text', async () => {
    await expect(detectFileType(Buffer.from('hello world'))).resolves.toBeNull();
  });
});

describe('auth rate limits', () => {
  test('refresh has a looser limit than login', async () => {
    const authRoutes = require('../src/routes/auth.routes');
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use('/auth', authRoutes);

    const ip = '9.9.9.9';
    // 10 refresh calls: never rate limited (strict bucket would stop at 5).
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/auth/refresh')
        .set('X-Forwarded-For', ip)
        .send({ refreshToken: 'not-a-real-token' });
      expect(res.status).not.toBe(429);
    }

    // Login from the same IP is still on the strict 5-per-window bucket.
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    }
    expect(last.status).toBe(429);
  });
});

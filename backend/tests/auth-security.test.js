process.env.NODE_ENV = 'test';
const path = require('path');
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '.mongodb-binaries');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../src/server');
const { generalLimiter, authLimiter, uploadLimiter } = require('../src/middleware/rateLimit');

let mongo;
jest.setTimeout(60000);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});
afterEach(() => {
  generalLimiter.resetKey('::ffff:127.0.0.1');
  authLimiter.resetKey('::ffff:127.0.0.1');
  uploadLimiter.resetKey('::ffff:127.0.0.1');
});

describe('auth security', () => {
  test('logout invalidates the refresh token', async () => {
    const app = createApp();
    const reg = await request(app)
      .post('/auth/register')
      .send({ email: 'logout@example.com', password: 'secure-pass-1234' })
      .expect(201);

    const { refreshToken, accessToken } = reg.body;

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);

    // The refresh token must no longer be usable.
    await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Access token still works until it expires.
    await request(app)
      .get('/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  test('refresh hashes are capped at 5 per user', async () => {
    const app = createApp();
    await request(app)
      .post('/auth/register')
      .send({ email: 'cap@example.com', password: 'secure-pass-1234' })
      .expect(201);

    const tokens = [];
    // Login 6 times to generate 6 refresh tokens (plus the one from register = 7 total attempts).
    for (let i = 0; i < 6; i += 1) {
      authLimiter.resetKey('::ffff:127.0.0.1');
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'cap@example.com', password: 'secure-pass-1234' })
        .expect(200);
      tokens.push(res.body.refreshToken);
    }

    const User = require('../src/models/User');
    const user = await User.findOne({ email: 'cap@example.com' }).select('+refreshTokenHashes');
    // Cap is 5; hashes from earliest logins are evicted.
    expect(user.refreshTokenHashes.length).toBeLessThanOrEqual(5);
  });

  test('login with unknown email returns 401 without leaking user existence', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'secure-pass-1234' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});

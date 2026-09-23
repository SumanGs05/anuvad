process.env.NODE_ENV = 'test';
const path = require('path');
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '.mongodb-binaries');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

jest.mock('../src/services/translation.service', () => ({
  translateBlocks: jest.fn(async (blocks) => blocks)
}));
jest.mock('../src/services/refinement.service', () => ({
  refineBlocks: jest.fn(async (_orig, blocks) => blocks)
}));

const env = require('../src/config/env');
const { createApp } = require('../src/server');
const { generalLimiter, authLimiter, uploadLimiter } = require('../src/middleware/rateLimit');
const { Document, Packer, Paragraph } = require('docx');

let mongo;
jest.setTimeout(30000);

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

async function docBuf() {
  return Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Test')] }] }));
}

describe('abuse limits', () => {
  test('registration requires password of 10+ characters', async () => {
    const app = createApp();
    const shortPassword = await request(app)
      .post('/auth/register')
      .send({ email: 'x@example.com', password: 'short' });
    expect(shortPassword.status).toBe(400);

    const exactlyTen = await request(app)
      .post('/auth/register')
      .send({ email: 'y@example.com', password: 'exactly10x' });
    expect(exactlyTen.status).toBe(201);
  });

  test('REGISTRATION_ENABLED=false blocks new registrations with 403', async () => {
    const original = env.registrationEnabled;
    env.registrationEnabled = false;
    const app = createApp();
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'z@example.com', password: 'secure-pass-1234' });
    expect(res.status).toBe(403);
    env.registrationEnabled = original;
  });

  test('DAILY_JOB_LIMIT blocks jobs after the daily limit is reached', async () => {
    const original = env.dailyJobLimit;
    env.dailyJobLimit = 2;

    const app = createApp();
    const reg = await request(app)
      .post('/auth/register')
      .send({ email: 'limittest@example.com', password: 'secure-pass-1234' })
      .expect(201);
    const { accessToken } = reg.body;

    const buf = await docBuf();

    // First two jobs should succeed (202).
    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post('/jobs')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('targetLanguage', 'hi')
        .attach('document', buf, {
          filename: 'test.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(202);
      uploadLimiter.resetKey('::ffff:127.0.0.1');
    }

    // Third job must be rejected.
    const blocked = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('targetLanguage', 'hi')
      .attach('document', buf, {
        filename: 'test.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    expect(blocked.status).toBe(429);

    env.dailyJobLimit = original;
    uploadLimiter.resetKey('::ffff:127.0.0.1');
  });
});

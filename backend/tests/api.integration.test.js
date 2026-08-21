process.env.NODE_ENV = 'test';
const path = require('path');
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '.mongodb-binaries');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Document, Packer, Paragraph } = require('docx');

jest.mock('../src/services/translation.service', () => ({ translateBlocks: jest.fn(async (blocks) => blocks) }));
jest.mock('../src/services/refinement.service', () => ({ refineBlocks: jest.fn(async (_original, blocks) => blocks) }));
const { createApp } = require('../src/server');
const { generalLimiter, authLimiter, uploadLimiter } = require('../src/middleware/rateLimit');
let mongo;
jest.setTimeout(600000);

beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });
afterEach(() => { generalLimiter.resetKey('::ffff:127.0.0.1'); authLimiter.resetKey('::ffff:127.0.0.1'); uploadLimiter.resetKey('::ffff:127.0.0.1'); });

async function account() {
  const response = await request(createApp()).post('/auth/register').send({ email: `person${Date.now()}@example.com`, password: 'secure-pass-123', name: 'Demo' }).expect(201);
  return response.body;
}
async function documentBuffer() { return Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Hello document')] }] })); }

test('registers, logs in, and rotates refresh tokens', async () => {
  const app = createApp();
  const registered = await request(app).post('/auth/register').send({ email: 'a@example.com', password: 'secure-pass-123' }).expect(201);
  const loggedIn = await request(app).post('/auth/login').send({ email: 'a@example.com', password: 'secure-pass-123' }).expect(200);
  const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: loggedIn.body.refreshToken }).expect(200);
  expect(registered.body.accessToken).toBeTruthy();
  expect(refreshed.body.accessToken).toBeTruthy();
  await request(app).post('/auth/refresh').send({ refreshToken: loggedIn.body.refreshToken }).expect(401);
});

test('uploads, translates, lists and downloads a document', async () => {
  const app = createApp(); const user = await account();
  const created = await request(app).post('/jobs').set('Authorization', `Bearer ${user.accessToken}`).field('targetLanguage', 'hi').attach('document', await documentBuffer(), { filename: 'source.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).expect(201);
  expect(created.body.job.status).toBe('completed');
  await request(app).get('/jobs').set('Authorization', `Bearer ${user.accessToken}`).expect(200).expect(({ body }) => expect(body.jobs).toHaveLength(1));
  await request(app).get(`/jobs/${created.body.job._id}/download`).set('Authorization', `Bearer ${user.accessToken}`).expect(200).expect('Content-Type', /application/);
});

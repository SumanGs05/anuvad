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

async function account(app, suffix) {
  const tag = suffix || Date.now();
  const response = await request(app)
    .post('/auth/register')
    .send({ email: `person${tag}@example.com`, password: 'secure-pass-1234', name: 'Demo' })
    .expect(201);
  return response.body;
}

async function documentBuffer() {
  return Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Hello document')] }] }));
}

/** Poll until the job reaches a terminal state or the timeout elapses. */
async function waitForJob(app, token, jobId, maxMs) {
  const deadline = Date.now() + (maxMs || 15000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const res = await request(app)
      .get(`/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    const { status } = res.body.job || {};
    if (status === 'completed' || status === 'failed') return res.body.job;
  }
  throw new Error(`Job ${jobId} did not complete within timeout`);
}

test('registers, logs in, refreshes tokens, and logs out', async () => {
  const app = createApp();
  const registered = await request(app)
    .post('/auth/register')
    .send({ email: 'a@example.com', password: 'secure-pass-1234' })
    .expect(201);
  const loggedIn = await request(app)
    .post('/auth/login')
    .send({ email: 'a@example.com', password: 'secure-pass-1234' })
    .expect(200);
  const refreshed = await request(app)
    .post('/auth/refresh')
    .send({ refreshToken: loggedIn.body.refreshToken })
    .expect(200);
  expect(registered.body.accessToken).toBeTruthy();
  expect(refreshed.body.accessToken).toBeTruthy();

  // Reuse of old refresh token must be rejected.
  await request(app)
    .post('/auth/refresh')
    .send({ refreshToken: loggedIn.body.refreshToken })
    .expect(401);

  // Logout invalidates the new refresh token.
  // Reset the auth limiter so the logout + final refresh don't hit the 5/window cap.
  authLimiter.resetKey('::ffff:127.0.0.1');
  await request(app)
    .post('/auth/logout')
    .send({ refreshToken: refreshed.body.refreshToken })
    .expect(200);
  await request(app)
    .post('/auth/refresh')
    .send({ refreshToken: refreshed.body.refreshToken })
    .expect(401);
});

test('uploads (202), polls to completion, lists, downloads, then deletes a job', async () => {
  const app = createApp();
  const user = await account(app, 'a');

  // Create job - must return 202 Accepted, not 201.
  const created = await request(app)
    .post('/jobs')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .field('targetLanguage', 'hi')
    .attach('document', await documentBuffer(), {
      filename: 'source.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    .expect(202);

  const jobId = created.body.job._id;

  // Poll for completion.
  const finalJob = await waitForJob(app, user.accessToken, jobId);
  expect(finalJob.status).toBe('completed');

  // List includes the job.
  await request(app)
    .get('/jobs')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200)
    .expect(({ body }) => expect(body.jobs).toHaveLength(1));

  // Download succeeds.
  await request(app)
    .get(`/jobs/${jobId}/download`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200)
    .expect('Content-Type', /application/);

  // Delete succeeds for owner.
  await request(app)
    .delete(`/jobs/${jobId}`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200);

  // After deletion, job is gone.
  await request(app)
    .get(`/jobs/${jobId}`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(404);
});

test('delete job returns 404 for a different user', async () => {
  const app = createApp();
  const owner = await account(app, 'owner');
  const other = await account(app, 'other');

  const created = await request(app)
    .post('/jobs')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .field('targetLanguage', 'hi')
    .attach('document', await documentBuffer(), {
      filename: 'source.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    .expect(202);

  await waitForJob(app, owner.accessToken, created.body.job._id);

  // Another user cannot delete the job.
  await request(app)
    .delete(`/jobs/${created.body.job._id}`)
    .set('Authorization', `Bearer ${other.accessToken}`)
    .expect(404);
});

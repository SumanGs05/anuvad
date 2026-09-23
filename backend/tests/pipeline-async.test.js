process.env.NODE_ENV = 'test';
const path = require('path');
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '.mongodb-binaries');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { Document, Packer, Paragraph } = require('docx');

jest.mock('../src/services/translation.service', () => ({
  translateBlocks: jest.fn(async (blocks) => blocks)
}));
jest.mock('../src/services/refinement.service', () => ({
  refineBlocks: jest.fn(async (_orig, blocks) => blocks)
}));

const { createApp } = require('../src/server');
const { generalLimiter, authLimiter, uploadLimiter } = require('../src/middleware/rateLimit');
const Job = require('../src/models/Job');
const { sweepStuckJobs } = require('../src/controllers/jobs.controller');

let mongo;
jest.setTimeout(120000);

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

async function registerAndLogin(app) {
  const tag = Date.now() + Math.random();
  const res = await request(app)
    .post('/auth/register')
    .send({ email: `u${tag}@test.com`, password: 'secure-pass-1234' })
    .expect(201);
  return res.body;
}

async function waitForJob(app, token, jobId, maxMs) {
  const deadline = Date.now() + (maxMs || 20000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const res = await request(app).get(`/jobs/${jobId}`).set('Authorization', `Bearer ${token}`);
    const s = res.body.job?.status;
    if (s === 'completed' || s === 'failed') return res.body.job;
  }
  throw new Error('Timed out waiting for job');
}

test('createJob returns 202 and job eventually reaches completed status', async () => {
  const app = createApp();
  const user = await registerAndLogin(app);

  const res = await request(app)
    .post('/jobs')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .field('targetLanguage', 'hi')
    .attach('document', await docBuf(), {
      filename: 'test.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    .expect(202);

  expect(res.body.job).toBeDefined();
  expect(res.body.job._id).toBeTruthy();

  const finalJob = await waitForJob(app, user.accessToken, res.body.job._id);
  expect(finalJob.status).toBe('completed');
});

test('pipeline does not log any document text content', async () => {
  const logger = require('../src/utils/logger');
  const logged = [];
  const captureLog = (...args) => logged.push(args);
  const spyInfo = jest.spyOn(logger, 'info').mockImplementation(captureLog);
  const spyWarn = jest.spyOn(logger, 'warn').mockImplementation(captureLog);
  const spyError = jest.spyOn(logger, 'error').mockImplementation(captureLog);

  // secretText must never appear in any log output.
  const { runPipeline } = require('../src/controllers/jobs.controller');
  const secretText = 'SECRET_DOCUMENT_CONTENT_XYZ';
  const fakeUserId = new mongoose.Types.ObjectId();
  const job = await Job.create({
    user: fakeUserId,
    originalFilename: `${secretText}.docx`,
    storedFilePath: 'uploads/nonexistent.docx',
    mimeType: 'application/docx',
    fileExtension: 'docx',
    targetLanguage: 'hi'
  });

  // Pipeline will fail (file doesn't exist) but that is fine; we only check what was logged.
  await runPipeline(job);

  spyInfo.mockRestore();
  spyWarn.mockRestore();
  spyError.mockRestore();

  const allLogged = JSON.stringify(logged);
  expect(allLogged).not.toContain(secretText);
});

test('sweepStuckJobs marks intermediate-state jobs as failed', async () => {
  // Create jobs in stuck states directly in the DB.
  const fakeUserId = new mongoose.Types.ObjectId();
  const stuck = await Job.create([
    { user: fakeUserId, originalFilename: 'a.docx', storedFilePath: 'uploads/a.docx', mimeType: 'application/docx', fileExtension: 'docx', targetLanguage: 'hi', status: 'parsing' },
    { user: fakeUserId, originalFilename: 'b.docx', storedFilePath: 'uploads/b.docx', mimeType: 'application/docx', fileExtension: 'docx', targetLanguage: 'hi', status: 'translating' },
    { user: fakeUserId, originalFilename: 'c.docx', storedFilePath: 'uploads/c.docx', mimeType: 'application/docx', fileExtension: 'docx', targetLanguage: 'hi', status: 'completed' },
  ]);

  await sweepStuckJobs();

  const results = await Job.find({ _id: { $in: stuck.map((j) => j._id) } });
  const byId = Object.fromEntries(results.map((j) => [j._id.toString(), j.status]));

  expect(byId[stuck[0]._id.toString()]).toBe('failed');   // was parsing
  expect(byId[stuck[1]._id.toString()]).toBe('failed');   // was translating
  expect(byId[stuck[2]._id.toString()]).toBe('completed'); // untouched
});

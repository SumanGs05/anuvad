process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/server');
const env = require('../src/config/env');
const { authLimiter } = require('../src/middleware/rateLimit');
const express = require('express');
const { handleUpload } = require('../src/middleware/upload');

describe('security controls', () => {
  test('rejects missing, malformed and expired access tokens', async () => {
    const app = createApp();
    await request(app).get('/jobs').expect(401);
    await request(app).get('/jobs').set('Authorization', 'Bearer nope').expect(401);
    const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, env.jwt.accessSecret, { expiresIn: -1 });
    await request(app).get('/jobs').set('Authorization', `Bearer ${expired}`).expect(401);
  });
  test('rejects unsupported and oversized uploads before pipeline execution', async () => {
    const app = express(); app.post('/upload', handleUpload, (_req, res) => res.status(201).end());
    await request(app).post('/upload').attach('document', Buffer.from('not a document'), 'fake.txt').expect(415);
    await request(app).post('/upload').attach('document', Buffer.alloc(10 * 1024 * 1024 + 1), 'too-large.pdf').expect(413);
  });
  test('limits repeated authentication attempts', async () => {
    const app = express(); app.post('/login', authLimiter, (_req, res) => res.status(401).end());
    for (let i = 0; i < 5; i += 1) await request(app).post('/login');
    await request(app).post('/login').expect(429);
    authLimiter.resetKey('::ffff:127.0.0.1');
  });
});

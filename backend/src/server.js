const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const jobsRoutes = require('./routes/jobs.routes');

function createApp() {
  const app = express();
  const origins = env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(helmet());
  app.use(cors({ origin: origins, credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(generalLimiter);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/jobs', jobsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  connectDB()
    .then(() => createApp().listen(env.port, () => console.log(`[server] Listening on port ${env.port}`)))
    .catch((err) => { console.error('[server] Failed to start', err); process.exit(1); });
}

module.exports = { createApp };

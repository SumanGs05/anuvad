const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const authRoutes = require('./routes/auth.routes');
const jobsRoutes = require('./routes/jobs.routes');
const logger = require('./utils/logger');
const { sweepStuckJobs } = require('./controllers/jobs.controller');
const { scheduleRetention } = require('./utils/retention');
const { ensureStorageDirs } = require('./utils/storageDirs');

function createApp() {
  const app = express();

  // Trust the first proxy hop so req.ip reflects the real client IP.
  // Without this every user behind Railway's load balancer shares one bucket.
  if (env.trustProxy !== 0) {
    app.set('trust proxy', env.trustProxy);
  }

  const origins = env.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(cors({ origin: origins, credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);
  app.use(generalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/jobs', jobsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// --------------------------------------------------------------------------
// Graceful shutdown
// --------------------------------------------------------------------------

function gracefulShutdown(server, signal) {
  logger.info(`Received ${signal}; shutting down gracefully`);

  // Stop accepting new connections.
  server.close(async () => {
    try {
      await disconnectDB();
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error('Error closing MongoDB on shutdown', err);
    }
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long.
  setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit', new Error('Shutdown timeout'));
    process.exit(1);
  }, 10000).unref();
}

if (require.main === module) {
  // --------------------------------------------------------------------------
  // Process-level safety net
  // --------------------------------------------------------------------------
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    process.exit(1);
  });

  ensureStorageDirs();

  connectDB()
    .then(async () => {
      await sweepStuckJobs();
      scheduleRetention();

      const app = createApp();
      const server = app.listen(env.port, () => {
        logger.info('Server started', { port: env.port, env: env.nodeEnv });
      });

      process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
    })
    .catch((err) => {
      logger.error('Failed to start server', err);
      process.exit(1);
    });
}

module.exports = { createApp };

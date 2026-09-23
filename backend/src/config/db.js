const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB(uri) {
  const target = uri || require('./env').mongoUri;
  await mongoose.connect(target);
  logger.info('MongoDB connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };

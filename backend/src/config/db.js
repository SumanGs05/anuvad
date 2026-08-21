const mongoose = require('mongoose');
const env = require('./env');

/**
 * Connects to MongoDB (local instance or Atlas, driven entirely by
 * MONGODB_URI). Never logs the connection string itself.
 */
async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  // eslint-disable-next-line no-console
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };

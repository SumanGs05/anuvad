/**
 * Ensures the storage directory structure exists at startup.
 * Called once before the server begins accepting requests.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('./logger');

function ensureStorageDirs() {
  const dirs = [
    path.join(env.storageDir, 'uploads'),
    path.join(env.storageDir, 'translated'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Created storage directory', { dir });
    }
  }
}

module.exports = { ensureStorageDirs };

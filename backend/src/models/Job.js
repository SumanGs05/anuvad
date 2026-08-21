const mongoose = require('mongoose');
const mongooseEncryption = require('mongoose-encryption');
const env = require('./../config/env');

const JOB_STATUSES = [
  'uploaded',
  'parsing',
  'translating',
  'refining',
  'reconstructing',
  'completed',
  'failed'
];

const SUPPORTED_LANGUAGES = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];

const jobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Original filename as supplied by the client. Encrypted at rest since
    // filenames can carry sensitive/identifying information.
    originalFilename: {
      type: String,
      required: true
    },
    // Path on local disk (relative to the /storage root), never the raw
    // document content itself. Encrypted at rest.
    storedFilePath: {
      type: String,
      required: true
    },
    translatedFilePath: {
      type: String,
      default: null
    },
    mimeType: {
      type: String,
      required: true
    },
    fileExtension: {
      type: String,
      required: true
    },
    sourceLanguage: {
      type: String,
      default: 'en'
    },
    targetLanguage: {
      type: String,
      required: true,
      enum: SUPPORTED_LANGUAGES
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'uploaded'
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Field-level encryption at rest for sensitive path/filename data.
// Keys are provided via environment variables and are never logged.
if (env.mongoEncryption.encryptionKey && env.mongoEncryption.signingKey) {
  jobSchema.plugin(mongooseEncryption, {
    encryptionKey: env.mongoEncryption.encryptionKey,
    signingKey: env.mongoEncryption.signingKey,
    encryptedFields: ['originalFilename', 'storedFilePath', 'translatedFilePath']
  });
}

jobSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // storedFilePath is an internal server-side detail; never exposed to
    // API clients.
    delete ret.storedFilePath;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Job', jobSchema);
module.exports.JOB_STATUSES = JOB_STATUSES;
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

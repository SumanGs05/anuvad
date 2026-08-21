const mongoose = require('mongoose');

/**
 * Append-only audit trail for translation jobs and auth events.
 * Never logs file contents, secrets, or tokens - only metadata about
 * who did what, when, and to which resource.
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    action: {
      type: String,
      required: true,
      enum: [
        'user.register',
        'user.login',
        'user.login_failed',
        'user.token_refresh',
        'user.logout',
        'job.created',
        'job.status_changed',
        'job.downloaded',
        'job.failed'
      ]
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null
    },
    metadata: {
      // Free-form, non-sensitive metadata only (e.g. targetLanguage,
      // originalFilename, status). Never file contents or secrets.
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
